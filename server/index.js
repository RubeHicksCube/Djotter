const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const NodeCache = require('node-cache');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const { formatInTimeZone } = require('date-fns-tz');
const rateLimit = require('express-rate-limit');

require('dotenv').config();

// Initialize cache (TTL: 5 minutes, check period: 60 seconds)
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const app = express();
const PORT = process.env.PORT || 8001;

// Import database and data access functions
const { db } = require('./database');
const dataAccess = require('./dataAccess');
const { initializeDefaultAdmin } = require('./initData');
const { generateTasksCSV, generateFieldsCSV, generateMultiFieldsCSV } = require('./csvGenerator');

// Import proper auth middleware
const { generateToken, authMiddleware } = require('./middleware/auth');

// Security headers with helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "https://static.cloudflareinsights.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://cloudflareinsights.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Enable gzip/brotli compression for responses
app.use(compression());

// Configure CORS for localhost development only
app.use(cors({
  origin: ['http://localhost:8001', 'http://localhost:8000'],
  credentials: true
}));
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many login attempts, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Cache helper functions
function getCacheKey(prefix, ...args) {
  return `${prefix}:${args.join(':')}`;
}

function invalidateUserCache(userId, date = null) {
  // Invalidate all cache entries for a user
  const keys = cache.keys();
  keys.forEach(key => {
    if (key.startsWith(`user:${userId}:`) ||
        key.startsWith(`settings:${userId}`) ||
        key.startsWith(`templates:${userId}`)) {
      // If date is provided, only invalidate that date's cache
      if (date && key.includes(':state:') && !key.includes(`:state:${date}`)) {
        return;
      }
      cache.del(key);
    }
  });
}

// Helper function to validate password strength
function validatePassword(password) {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  // Check for at least one number
  if (!/\d/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }

  // Check for at least one letter
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one letter' };
  }

  return { valid: true };
}

// Helper function to get current date in user's timezone
function getCurrentDateInUserTimezone(userId) {
  const settings = dataAccess.getUserSettings(userId);
  const timezone = settings?.timezone || 'UTC';
  
  // Get the current time and convert to user's timezone
  const now = new Date();
  const userDateTime = formatInTimeZone(now, timezone, 'yyyy-MM-dd HH:mm:ss');
  const userDate = userDateTime.split(' ')[0];
  
  return userDate;
}

// Helper function to get or initialize user state from database for specific date
function getUserStateForDate(userId, targetDate) {
  // Check cache first
  const cacheKey = getCacheKey('user', userId, 'state', targetDate);
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Get daily state (bedtime, wake time)
  const dailyState = dataAccess.getDailyState(userId, targetDate) || {
    previous_bedtime: '',
    wake_time: ''
  };

  // Get templates
  const templates = dataAccess.getCustomFieldTemplates(userId);

  // Get daily custom field values (template-based)
  const dailyFieldsFromDB = dataAccess.getDailyCustomFields(userId, targetDate);

  // Separate template-based and daily-only fields
  const templateFields = dailyFieldsFromDB.filter(f => f.isTemplate);
  const dailyOnlyFields = dailyFieldsFromDB.filter(f => !f.isTemplate);

  // Merge templates with values
  const customFields = templates.map(template => {
    const valueField = templateFields.find(f => f.key === template.key);
    let value = valueField ? valueField.value : '';
    
    // Convert boolean strings to actual boolean values for proper checkbox handling
    if (template.field_type === 'boolean') {
      value = value === 'true' ? 'true' : 'false'; // Ensure consistent string representation
    }
    
    return {
      id: valueField ? valueField.id : template.id,
      key: template.key,
      value: value,
      field_type: template.field_type || 'text'
    };
  });

  // Get tasks
  const tasksFromDB = dataAccess.getDailyTasks(userId, targetDate);
  const dailyTasks = tasksFromDB.map(t => ({
    id: t.id,
    text: t.text,
    completed: t.done
  }));

  // Get activity entries
  const entriesFromDB = dataAccess.getActivityEntries(userId, targetDate);
  const entries = entriesFromDB.map(e => ({
    id: e.id,
    timestamp: e.timestamp, // Send full timestamp, let client format it
    text: e.text,
    image: e.image
  }));

  // Get time since trackers (persistent)
  const timeSinceTrackers = dataAccess.getTimeSinceTrackers(userId);

  // Get duration trackers (persistent)
  const durationTrackers = dataAccess.getDurationTrackers(userId);

  // Get custom counters
  const customCountersFromDB = dataAccess.getCustomCounters(userId);
  const customCounters = customCountersFromDB.map(counter => ({
    id: counter.id,
    name: counter.name,
    value: dataAccess.getCustomCounterValue(counter.id, targetDate)
  }));

  const state = {
    date: targetDate,
    previousBedtime: dailyState.previous_bedtime || '',
    wakeTime: dailyState.wake_time || '',
    customFields: customFields,
    dailyCustomFields: dailyOnlyFields.map(f => ({
      id: f.id,
      key: f.key,
      value: f.value
    })),
    dailyTasks: dailyTasks,
    customCounters: customCounters,
    entries: entries,
    timeSinceTrackers: timeSinceTrackers,
    durationTrackers: durationTrackers
  };

  // Cache the result
  cache.set(cacheKey, state);

  return state;
}

// Helper function to get or initialize user state from database
function getUserState(userId) {
  const currentDate = getCurrentDateInUserTimezone(userId);

  // Get daily state (bedtime, wake time)
  const dailyState = dataAccess.getDailyState(userId, currentDate) || {
    previous_bedtime: '',
    wake_time: ''
  };

  // Get templates
  const templates = dataAccess.getCustomFieldTemplates(userId);

  // Get daily custom field values (template-based)
  const dailyFieldsFromDB = dataAccess.getDailyCustomFields(userId, currentDate);

  // Separate template-based and daily-only fields
  const templateFields = dailyFieldsFromDB.filter(f => f.isTemplate);
  const dailyOnlyFields = dailyFieldsFromDB.filter(f => !f.isTemplate);

  // Merge templates with values
  const customFields = templates.map(template => {
    const valueField = templateFields.find(f => f.key === template.key);
    return {
      id: valueField ? valueField.id : template.id,
      key: template.key,
      value: valueField ? valueField.value : (template.field_type === 'boolean' ? false : ''),
      field_type: template.field_type || 'text'
    };
  });

  // Get tasks
  const tasksFromDB = dataAccess.getDailyTasks(userId, currentDate);
  const dailyTasks = tasksFromDB.map(t => ({
    id: t.id,
    text: t.text,
    completed: t.done
  }));

  // Get activity entries
  const entriesFromDB = dataAccess.getActivityEntries(userId, currentDate);
  const entries = entriesFromDB.map(e => ({
    id: e.id,
    timestamp: e.timestamp, // Send full timestamp, let client format it
    text: e.text,
    image: e.image
  }));

  // Get time since trackers (persistent)
  const timeSinceTrackers = dataAccess.getTimeSinceTrackers(userId);

  // Get duration trackers (persistent)
  const durationTrackers = dataAccess.getDurationTrackers(userId);

  // Get custom counters
  const customCountersFromDB = dataAccess.getCustomCounters(userId);
  const customCounters = customCountersFromDB.map(counter => ({
    id: counter.id,
    name: counter.name,
    value: dataAccess.getCustomCounterValue(counter.id, currentDate)
  }));

  return {
    date: currentDate,
    previousBedtime: dailyState.previous_bedtime || '',
    wakeTime: dailyState.wake_time || '',
    customFields: customFields,
    dailyCustomFields: dailyOnlyFields.map(f => ({
      id: f.id,
      key: f.key,
      value: f.value
    })),
    dailyTasks: dailyTasks,
    customCounters: customCounters,
    entries: entries,
    timeSinceTrackers: timeSinceTrackers,
    durationTrackers: durationTrackers
  };
}

// Helper function to generate YAML frontmatter and markdown content
function generateMarkdownWithYAML(dayData, username = null, userProfileFields = null) {
  let yaml = '---\n';

  // User Information (at the top)
  if (username) {
    yaml += `# User Information\n`;
    yaml += `user: "${username}"\n`;
  }
  yaml += `date: "${dayData.date}"\n`;
  yaml += '\n';

  // Profile Fields (right after user info)
  if (userProfileFields && Object.keys(userProfileFields).length > 0) {
    yaml += '# Profile Fields\n';
    yaml += 'profile:\n';
    Object.entries(userProfileFields).forEach(([key, value]) => {
      yaml += `  ${key}: "${String(value).replace(/"/g, '\\"')}"\n`;
    });
    yaml += '\n';
  }

  // Sleep Metrics
  if (dayData.previousBedtime || dayData.wakeTime) {
    yaml += '# Sleep Metrics\n';
    if (dayData.previousBedtime) {
      yaml += `bedtime: "${dayData.previousBedtime}"\n`;
    }
    if (dayData.wakeTime) {
      yaml += `wake_time: "${dayData.wakeTime}"\n`;
    }
    yaml += '\n';
  }

  // Time Since Trackers (persist across days)
  if (dayData.timeSinceTrackers && dayData.timeSinceTrackers.length > 0) {
    yaml += '# Time Since Trackers (persist across days)\n';
    yaml += 'time_since_trackers:\n';
    dayData.timeSinceTrackers.forEach(t => {
      yaml += `  - name: "${t.name.replace(/"/g, '\\"')}"\n`;
      yaml += `    date: "${t.date}"\n`;
      yaml += `    time_since: "${calculateTimeSince(t.date)}"\n`;
    });
    yaml += '\n';
  }

  // Duration Trackers (persist across days)
  if (dayData.durationTrackers && dayData.durationTrackers.length > 0) {
    yaml += '# Duration Trackers (persist across days)\n';
    yaml += 'duration_trackers:\n';
    dayData.durationTrackers.forEach(t => {
      yaml += `  - name: "${t.name.replace(/"/g, '\\"')}"\n`;
      yaml += `    type: "${t.type}"\n`;
      yaml += `    value: ${t.value}\n`;

      // Add formatted value for better readability
      if (t.type === 'timer') {
        yaml += `    formatted: "${formatDuration(t.value)}"\n`;

        // If timer is running, show current elapsed time
        if (t.isRunning && t.startTime) {
          yaml += `    is_running: true\n`;
          const currentElapsed = getCurrentElapsedTime(t);
          yaml += `    current_time: "${formatDuration(currentElapsed)}"\n`;
        } else {
          yaml += `    is_running: false\n`;
        }
      } else if (t.type === 'counter') {
        yaml += `    formatted: "${t.value} minutes"\n`;
      }
    });
    yaml += '\n';
  }

  // Custom Counters (persist but values reset daily)
  if (dayData.customCounters && dayData.customCounters.length > 0) {
    yaml += '# Custom Counters (persist but values reset daily)\n';
    yaml += 'custom_counters:\n';
    dayData.customCounters.forEach(c => {
      yaml += `  - name: "${c.name}"\n`;
      yaml += `    value: ${c.value}\n`;
    });
    yaml += '\n';
  }

  // Template Fields (persist template, values reset daily)
  if (dayData.customFields && dayData.customFields.length > 0) {
    yaml += '# Template Fields (persist template, values reset daily)\n';
    yaml += 'template_fields:\n';
    dayData.customFields.forEach(f => {
      if (f.value) {
        yaml += `  ${f.key}: "${f.value.replace(/"/g, '\\"')}"\n`;
      }
    });
    yaml += '\n';
  }

  // Daily Fields (do not persist)
  if (dayData.dailyCustomFields && dayData.dailyCustomFields.length > 0) {
    yaml += '# Daily Fields (do not persist)\n';
    yaml += 'daily_fields:\n';
    dayData.dailyCustomFields.forEach(f => {
      if (f.value) {
        yaml += `  ${f.key}: "${f.value.replace(/"/g, '\\"')}"\n`;
      }
    });
    yaml += '\n';
  }

  // Daily Tasks
  if (dayData.dailyTasks && dayData.dailyTasks.length > 0) {
    yaml += '# Daily Tasks\n';
    yaml += 'tasks:\n';
    dayData.dailyTasks.forEach(t => {
      yaml += `  - text: "${t.text.replace(/"/g, '\\"')}"\n`;
      yaml += `    completed: ${t.completed}\n`;
    });
    yaml += '\n';
  }

  yaml += '---\n\n';

  // Markdown content - Activity Entries
  let content = '# Activity Entries\n\n';
  if (dayData.entries && dayData.entries.length > 0) {
    dayData.entries.forEach(e => {
      content += `## ${e.timestamp}\n\n${e.text}\n\n`;

      // Include base64 embedded image if present
      if (e.image) {
        content += `![Entry Image](${e.image})\n\n`;
      }
    });
  } else {
    content += '_No entries today._\n';
  }

  return yaml + content;
}

// Helper function to calculate time since for exports (server-side)
function calculateTimeSince(dateStr) {
  const then = new Date(dateStr);
  const now = new Date();
  let diffMinutes = Math.floor((now - then) / (1000 * 60));

  const years = Math.floor(diffMinutes / (365.25 * 24 * 60));
  diffMinutes -= Math.floor(years * 365.25 * 24 * 60);

  const months = Math.floor(diffMinutes / (30.44 * 24 * 60));
  diffMinutes -= Math.floor(months * 30.44 * 24 * 60);

  const weeks = Math.floor(diffMinutes / (7 * 24 * 60));
  diffMinutes -= weeks * 7 * 24 * 60;

  const days = Math.floor(diffMinutes / (24 * 60));
  diffMinutes -= days * 24 * 60;

  const hours = Math.floor(diffMinutes / 60);
  diffMinutes -= hours * 60;

  const minutes = diffMinutes;

  const parts = [];
  if (years > 0) parts.push(`${years}y`);
  if (months > 0) parts.push(`${months}mo`);
  if (weeks > 0) parts.push(`${weeks}w`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

  return parts.join(' ');
}

// Helper function to format duration for PDF and exports
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

// Helper function to format elapsed time as HH:MM:SS or MM:SS (matches UI display)
function formatElapsedTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Get current elapsed time for running timer
function getCurrentElapsedTime(tracker) {
  if (tracker.type !== 'timer') return tracker.value;

  let totalSeconds = tracker.value || 0;

  if (tracker.isRunning && tracker.startTime) {
    const elapsed = Math.floor((Date.now() - tracker.startTime) / 1000);
    totalSeconds += elapsed;
  }

  return totalSeconds;
}

// Helper function to format date for PDF
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getFullYear()}-${months[date.getMonth()]}-${String(date.getDate()).padStart(2, '0')}`;
}

// Helper function to generate PDF report using PDFKit
async function generatePDFReport(dayData, username = null, userProfileFields = null) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Header with purple background
    doc.rect(0, 0, doc.page.width, 100).fillAndStroke('#6B46C1', '#6B46C1');
    doc.fillColor('#FFFFFF')
       .fontSize(24)
       .text('DAILY JOURNAL REPORT', 50, 30, { align: 'center' });
    doc.fontSize(14)
       .text(formatDate(dayData.date), 50, 60, { align: 'center' });

    // Move cursor down after header
    doc.fillColor('#000000');
    doc.y = 120;
    doc.moveDown(1);

    // User Information Section
    if (username) {
      doc.fontSize(16).fillColor('#6B46C1').text('USER INFORMATION', { underline: true });
      doc.fontSize(12).fillColor('#000000').text(`Username: ${username}`);
      doc.moveDown();
    }

    // Profile Fields Section
    if (userProfileFields && Object.keys(userProfileFields).length > 0) {
      doc.fontSize(16).fillColor('#6B46C1').text('PROFILE', { underline: true });
      for (const [key, value] of Object.entries(userProfileFields)) {
        const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
        doc.fontSize(12).fillColor('#000000').text(`${capitalizedKey}: ${value}`);
      }
      doc.moveDown();
    }

    // Sleep Metrics
    if (dayData.previousBedtime || dayData.wakeTime) {
      doc.fontSize(16).fillColor('#6B46C1').text('SLEEP METRICS', { underline: true });
      if (dayData.previousBedtime) doc.fontSize(12).fillColor('#000000').text(`Bedtime: ${dayData.previousBedtime}`);
      if (dayData.wakeTime) doc.fontSize(12).fillColor('#000000').text(`Wake Time: ${dayData.wakeTime}`);
      doc.moveDown();
    }

    // Time Since Trackers
    if (dayData.timeSinceTrackers && dayData.timeSinceTrackers.length > 0) {
      doc.fontSize(16).fillColor('#6B46C1').text('TIME SINCE TRACKERS', { underline: true });
      dayData.timeSinceTrackers.forEach(t => {
        const timeSince = calculateTimeSince(t.date);
        doc.fontSize(12).fillColor('#000000').text(`• ${t.name}: ${formatDate(t.date)} (${timeSince})`);
      });
      doc.moveDown();
    }

    // Duration Trackers
    if (dayData.durationTrackers && dayData.durationTrackers.length > 0) {
      doc.fontSize(16).fillColor('#6B46C1').text('DURATION TRACKERS', { underline: true });
      dayData.durationTrackers.forEach(t => {
        if (t.type === 'timer') {
          const storedValue = formatDuration(t.value);
          if (t.isRunning && t.startTime) {
            const currentElapsed = getCurrentElapsedTime(t);
            const currentValue = formatDuration(currentElapsed);
            doc.fontSize(12).fillColor('#000000').text(`• ${t.name} (timer): ${currentValue} [RUNNING - stored: ${storedValue}]`);
          } else {
            doc.fontSize(12).fillColor('#000000').text(`• ${t.name} (timer): ${storedValue}`);
          }
        } else {
          doc.fontSize(12).fillColor('#000000').text(`• ${t.name} (${t.type}): ${t.value} minutes`);
        }
      });
      doc.moveDown();
    }

    // Custom Counters
    if (dayData.customCounters && dayData.customCounters.length > 0) {
      doc.fontSize(16).fillColor('#6B46C1').text('CUSTOM COUNTERS', { underline: true });
      dayData.customCounters.forEach(c => {
        doc.fontSize(12).fillColor('#000000').text(`• ${c.name}: ${c.value}`);
      });
      doc.moveDown();
    }

    // Template Fields
    if (dayData.customFields && dayData.customFields.length > 0) {
      const filledFields = dayData.customFields.filter(f => f.value);
      if (filledFields.length > 0) {
        doc.fontSize(16).fillColor('#6B46C1').text('TEMPLATE FIELDS', { underline: true });
        filledFields.forEach(f => {
          const capitalizedKey = f.key.charAt(0).toUpperCase() + f.key.slice(1);
          doc.fontSize(12).fillColor('#000000').text(`• ${capitalizedKey}: ${f.value}`);
        });
        doc.moveDown();
      }
    }

    // Daily Custom Fields
    if (dayData.dailyCustomFields && dayData.dailyCustomFields.length > 0) {
      const filledFields = dayData.dailyCustomFields.filter(f => f.value);
      if (filledFields.length > 0) {
        doc.fontSize(16).fillColor('#6B46C1').text('DAILY FIELDS', { underline: true });
        filledFields.forEach(f => {
          const capitalizedKey = f.key.charAt(0).toUpperCase() + f.key.slice(1);
          doc.fontSize(12).fillColor('#000000').text(`• ${capitalizedKey}: ${f.value}`);
        });
        doc.moveDown();
      }
    }

    // Daily Tasks
    if (dayData.dailyTasks && dayData.dailyTasks.length > 0) {
      doc.fontSize(16).fillColor('#6B46C1').text('DAILY TASKS', { underline: true });
      dayData.dailyTasks.forEach(t => {
        const check = t.completed ? '✓' : '○';
        doc.fontSize(12).fillColor('#000000').text(`${check} ${t.text}`);
      });
      doc.moveDown();
    }

    // Activity Entries
    if (dayData.entries && dayData.entries.length > 0) {
      doc.fontSize(16).fillColor('#6B46C1').text('ACTIVITY ENTRIES', { underline: true });
      dayData.entries.forEach(e => {
        // Check if we need a new page
        if (doc.y > doc.page.height - 150) {
          doc.addPage();
        }

        doc.strokeColor('#CCCCCC').moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor('#6B46C1').text(e.timestamp, { continued: false });
        doc.fontSize(12).fillColor('#000000').text(e.text, { align: 'left' });

        // Handle images (base64 embedded images)
        if (e.image) {
          try {
            // Extract base64 data
            const base64Data = e.image.split(',')[1] || e.image;
            const imageBuffer = Buffer.from(base64Data, 'base64');

            // Check if we need a new page for the image
            if (doc.y > doc.page.height - 250) {
              doc.addPage();
            }

            doc.moveDown(0.5);
            doc.image(imageBuffer, 50, doc.y, { width: 400, fit: [400, 300] });
            doc.moveDown(10); // Move down to account for image height
          } catch (imageError) {
            console.error('Error embedding image in PDF:', imageError);
            doc.fontSize(10).fillColor('#999999').text('[Image could not be embedded]');
          }
        }

        doc.moveDown();
      });
    } else {
      doc.fontSize(16).fillColor('#6B46C1').text('ACTIVITY ENTRIES', { underline: true });
      doc.fontSize(12).fillColor('#999999').text('No entries today', { italic: true });
      doc.moveDown();
    }

    doc.end();
  });
}

// Login endpoint
app.post('/api/auth/login', authLimiter, (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Find user by username or email
  let user = dataAccess.getUserByUsername(username);
  if (!user) {
    user = dataAccess.getUserByEmail(username);
  }

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Verify password using bcrypt
  const passwordValid = bcrypt.compareSync(password, user.password_hash);

  if (!passwordValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken(user);
  res.json({
    success: true,
    token,
    user: { id: user.id, username: user.username, is_admin: user.is_admin }
  });
});

// Get current user
app.get('/api/users/me', authMiddleware, (req, res) => {
  // Look up full user details from database
  const user = dataAccess.getUserById(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Get user's profile fields from database
  const userProfileFields = dataAccess.getProfileFields(req.user.id);

  // Get current date in user's timezone
  const currentDate = getCurrentDateInUserTimezone(req.user.id);

  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email || null,
      is_admin: user.is_admin
    },
    profileFields: userProfileFields,
    currentDate: currentDate
  });
});

// Get user settings
app.get('/api/users/me/settings', authMiddleware, (req, res) => {
  try {
    const settings = dataAccess.getUserSettings(req.user.id);
    res.json(settings);
  } catch (error) {
    console.error('Error getting user settings:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Update user settings
app.put('/api/users/me/settings', authMiddleware, (req, res) => {
  try {
    const { theme, timezone, autoSave } = req.body;
    dataAccess.updateUserSettings(req.user.id, { theme, timezone, autoSave });
    const settings = dataAccess.getUserSettings(req.user.id);
    res.json(settings);
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Profile field management
app.put('/api/users/profile-field', authMiddleware, (req, res) => {
  const { key, value } = req.body;

  if (!key || value === undefined) {
    return res.status(400).json({ error: 'Key and value required' });
  }

  // Save the profile field to database
  dataAccess.setProfileField(req.user.id, key, value);

  console.log(`Setting profile field for user ${req.user.id}: ${key} = ${value}`);
  res.json({ success: true });
});

app.delete('/api/users/profile-field/:key', authMiddleware, (req, res) => {
  const { key } = req.params;

  // Remove the profile field from database
  dataAccess.deleteProfileField(req.user.id, key);

  console.log(`Deleting profile field for user ${req.user.id}: ${key}`);
  res.json({ success: true });
});

// Update user profile
app.put('/api/users/me', authMiddleware, (req, res) => {
  const { username, email, currentPassword, newPassword } = req.body;

  // Find user in database
  const user = dataAccess.getUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Prepare updates
  const updates = {};
  if (username) updates.username = username;
  if (email !== undefined) updates.email = email;

  // Update in database
  dataAccess.updateUser(req.user.id, updates);

  console.log(`Updated profile for user ${req.user.id}:`, { username, email });

  // Fetch updated user
  const updatedUser = dataAccess.getUserById(req.user.id);
  res.json({
    success: true,
    user: {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email
    }
  });
});

// Get all users (admin only)
app.get('/api/users/list', authMiddleware, (req, res) => {
  // Check if user is admin
  console.log('GET /api/users/list - req.user:', req.user);
  if (!req.user || !req.user.is_admin) {
    console.log('403 Forbidden - is_admin:', req.user?.is_admin);
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const userList = dataAccess.getAllUsers();

  res.json({ users: userList });
});

// Create new user (admin only)
app.post('/api/users/create', authMiddleware, (req, res) => {
  const { username, password, email, is_admin } = req.body;

  // Check if user is admin
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Unauthorized to create users' });
  }

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }

  // Validate password strength
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    return res.status(400).json({ error: passwordCheck.error });
  }

  // Check if username already exists
  if (dataAccess.getUserByUsername(username)) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  // Hash the password
  const password_hash = bcrypt.hashSync(password, 10);

  // Create new user in database
  const newUserId = dataAccess.createUser(username, email || null, password_hash, !!is_admin);
  const newUser = dataAccess.getUserById(newUserId);

  console.log(`Created new user:`, { id: newUser.id, username: newUser.username });
  res.json({
    success: true,
    user: {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      is_admin: newUser.is_admin,
      created_at: newUser.created_at
    }
  });
});

// Reset user password (admin only)
app.put('/api/users/:id/reset-password', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  // Check if user is admin
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Validate password strength
  const passwordCheck = validatePassword(newPassword);
  if (!passwordCheck.valid) {
    return res.status(400).json({ error: passwordCheck.error });
  }

  // Find target user
  const targetUser = dataAccess.getUserById(parseInt(id));
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Hash new password and update
  const password_hash = bcrypt.hashSync(newPassword, 10);
  dataAccess.updateUser(parseInt(id), { password_hash });

  console.log(`Admin reset password for user: ${targetUser.username}`);
  res.json({ success: true, message: 'Password reset successfully' });
});

// Update user (admin only)
app.put('/api/users/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { username, email, is_admin } = req.body;

  // Check if user is admin
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Find target user
  const targetUser = dataAccess.getUserById(parseInt(id));
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Check if new username is already taken
  if (username && username !== targetUser.username) {
    const existingUser = dataAccess.getUserByUsername(username);
    if (existingUser && existingUser.id !== parseInt(id)) {
      return res.status(400).json({ error: 'Username already taken' });
    }
  }

  // Prepare updates
  const updates = {};
  if (username && username !== targetUser.username) {
    updates.username = username;
  }
  if (email !== undefined) {
    updates.email = email || null;
  }
  if (is_admin !== undefined) {
    updates.is_admin = is_admin ? 1 : 0;
  }

  // Update in database
  dataAccess.updateUser(parseInt(id), updates);

  // Fetch updated user
  const updatedUser = dataAccess.getUserById(parseInt(id));
  console.log(`Admin updated user:`, { id: updatedUser.id, username: updatedUser.username, email: updatedUser.email, is_admin: updatedUser.is_admin });
  res.json({
    success: true,
    user: {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      is_admin: updatedUser.is_admin
    }
  });
});

// Delete user (admin only)
app.delete('/api/users/:id', authMiddleware, (req, res) => {
  const { id } = req.params;

  const userId = parseInt(id);

  // Check if user is admin or deleting their own account
  if (!req.user || (!req.user.is_admin && userId !== req.user.id)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Allow users to delete their own account, but prevent admins from deleting themselves
  if (userId === req.user.id && req.user.is_admin) {
    return res.status(400).json({ error: 'Admins cannot delete their own account through User Management' });
  }

  // Find user
  const targetUser = dataAccess.getUserById(userId);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  const deletedUsername = targetUser.username;
  const isSelfDeletion = userId === req.user.id;
  
  // Delete the user
  dataAccess.deleteUser(userId);

  if (isSelfDeletion) {
    console.log(`User deleted their own account: ${deletedUsername}`);
    res.json({ success: true, message: 'Your account has been deleted successfully' });
  } else {
    console.log(`Admin deleted user: ${deletedUsername}`);
    res.json({ success: true, message: 'User deleted successfully' });
  }
});

// Get current state (Home page data)
app.get('/api/state', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const state = getUserState(userId);
  res.json(state);
});

// Get state for specific date
app.get('/api/state/:date', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const date = req.params.date;
  
  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }
  
  const state = getUserStateForDate(userId, date);
  res.json(state);
});

// Get all tasks (not filtered by date)
app.get('/api/tasks/all', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const allTasks = dataAccess.getDailyTasks(userId); // No date parameter = all tasks
  res.json({ tasks: allTasks });
});

// Update daily data
app.post('/api/daily', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const data = req.body;
  console.log('Updating daily data:', data);

  // Use provided date or current date
  const targetDate = data.date || getCurrentDateInUserTimezone(userId);

  // Update daily state in database
  const previousBedtime = data.previousBedtime !== undefined ? data.previousBedtime : '';
  const wakeTime = data.wakeTime !== undefined ? data.wakeTime : '';

  dataAccess.setDailyState(userId, targetDate, previousBedtime, wakeTime);

  // Invalidate cache to ensure fresh data is returned
  invalidateUserCache(userId, targetDate);

  // Return state for the target date
  const state = getUserStateForDate(userId, targetDate);
  res.json(state);
});

// Add entry
app.post('/api/entry', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { text, image, date } = req.body;
  console.log('Adding entry:', text, image ? '(with image)' : '', date ? `for date: ${date}` : '');

  // Validate image size if present (20MB limit)
  if (image) {
    // Base64 encoding adds ~33% overhead, so actual limit is ~15MB of base64
    const sizeInBytes = (image.length * 3) / 4;
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (sizeInBytes > maxSize) {
      return res.status(400).json({ error: 'Image size exceeds 20MB limit' });
    }
  }

  // Use provided date or current date
  const targetDate = date || getCurrentDateInUserTimezone(userId);

  // Create entry in database
  dataAccess.createActivityEntry(userId, targetDate, text, image);

  // Invalidate cache to ensure fresh data is returned
  invalidateUserCache(userId, targetDate);

  // Return state for the target date
  const state = getUserStateForDate(userId, targetDate);
  res.json(state);
});

// Delete entry
app.put('/api/entry/:id', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const entryId = parseInt(req.params.id);
  const { text } = req.body;

  try {
    dataAccess.updateActivityEntry(entryId, text);
    // Invalidate cache to ensure fresh data is returned
    invalidateUserCache(userId);
    const state = getUserState(userId);
    res.json(state);
  } catch (error) {
    console.error('Error updating entry:', error);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

app.delete('/api/entry/:id', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const entryId = parseInt(req.params.id);

  try {
    dataAccess.deleteActivityEntry(entryId);
    // Invalidate cache to ensure fresh data is returned
    invalidateUserCache(userId);
    const state = getUserState(userId);
    res.json(state);
  } catch (error) {
    console.error('Error deleting entry:', error);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

// Download markdown (current day)
app.get('/api/download', (req, res) => {
  const token = req.query.token;

  // Verify token from query parameter (for direct navigation)
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const userId = decoded.id;

  // Get user info and profile fields from database
  const user = dataAccess.getUserById(userId);
  const username = user ? user.username : null;
  const userProfileFields = dataAccess.getProfileFields(userId);

  const state = getUserState(userId);
  const markdown = generateMarkdownWithYAML(state, username, userProfileFields);

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${state.date}.md"`);
  res.send(markdown);
});

// Download PDF (current day)
app.get('/api/download-pdf', async (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const userId = decoded.id;

  try {
    const user = dataAccess.getUserById(userId);
    const username = user ? user.username : null;
    const userProfileFields = dataAccess.getProfileFields(userId);

    const state = getUserState(userId);
    const pdfBuffer = await generatePDFReport(state, username, userProfileFields);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${state.date}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
  }
});

// Save daily snapshot
app.post('/api/exports/save-snapshot', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const currentDate = getCurrentDateInUserTimezone(userId);

  try {
    // Get the current state
    const state = getUserState(userId);

    // Save snapshot to database
    dataAccess.saveSnapshot(userId, currentDate, state);

    console.log(`Snapshot saved for user ${userId} on ${currentDate}`);
    res.json({ success: true, date: currentDate });
  } catch (error) {
    console.error('Error saving snapshot:', error);
    res.status(500).json({ error: 'Failed to save snapshot' });
  }
});

// Get available export dates for current user
app.get('/api/exports/available-dates', authMiddleware, (req, res) => {
  const userId = req.user.id;

  try {
    const snapshots = dataAccess.getSnapshots(userId);
    const dates = snapshots.map(s => s.date);

    res.json({ dates });
  } catch (error) {
    console.error('Error getting available dates:', error);
    res.status(500).json({ error: 'Failed to retrieve available dates' });
  }
});

// Get a specific snapshot by date
app.get('/api/exports/snapshot/:date', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { date } = req.params;

  try {
    const snapshot = dataAccess.getSnapshot(userId, date);

    if (!snapshot) {
      return res.status(404).json({ error: 'Snapshot not found for this date' });
    }

    res.json({ snapshot, date });
  } catch (error) {
    console.error('Error getting snapshot:', error);
    res.status(500).json({ error: 'Failed to get snapshot' });
  }
});

// Delete a specific snapshot
app.delete('/api/exports/snapshot/:date', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { date } = req.params;

  try {
    dataAccess.deleteSnapshot(userId, date);

    // Return updated list of available dates
    const snapshots = dataAccess.getSnapshots(userId);
    const dates = snapshots.map(s => s.date);

    console.log(`Snapshot deleted for user ${userId}, date ${date}`);
    res.json({ success: true, dates });
  } catch (error) {
    console.error('Error deleting snapshot:', error);
    res.status(500).json({ error: 'Failed to delete snapshot' });
  }
});

// Search log entries across all snapshots
app.post('/api/exports/search-entries', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { searchText, searchDate } = req.body;

  try {
    const results = [];

    if (searchDate) {
      // If date is provided, search only that date's snapshot
      const snapshot = dataAccess.getSnapshot(userId, searchDate);
      if (snapshot && snapshot.entries) {
        const searchLower = searchText?.toLowerCase() || '';
        const matchingEntries = snapshot.entries.filter(entry =>
          !searchText || entry.text.toLowerCase().includes(searchLower)
        );
        matchingEntries.forEach(entry => {
          results.push({
            ...entry,
            date: searchDate
          });
        });
      }
    } else if (searchText && searchText.trim()) {
      // If only text is provided, search all snapshots
      const snapshotDates = dataAccess.getSnapshots(userId);
      const searchLower = searchText.toLowerCase();

      snapshotDates.forEach(snapshotInfo => {
        const snapshotData = dataAccess.getSnapshot(userId, snapshotInfo.date);
        if (snapshotData && snapshotData.entries) {
          const matchingEntries = snapshotData.entries.filter(entry =>
            entry.text.toLowerCase().includes(searchLower)
          );
          matchingEntries.forEach(entry => {
            results.push({
              ...entry,
              date: snapshotInfo.date
            });
          });
        }
      });

      // Sort by date and time, most recent first
      results.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.timestamp}`);
        const dateB = new Date(`${b.date}T${b.timestamp}`);
        return dateB - dateA;
      });
    }

    res.json({ entries: results });
  } catch (error) {
    console.error('Error searching entries:', error);
    res.status(500).json({ error: 'Failed to search entries' });
  }
});

// Get snapshot retention settings
app.get('/api/exports/retention-settings', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const settings = dataAccess.getSnapshotSettings(userId);
  res.json({ maxDays: settings.max_days, maxCount: settings.max_count });
});

// Update snapshot retention settings
app.put('/api/exports/retention-settings', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { maxDays, maxCount } = req.body;

  const parsedMaxDays = maxDays !== undefined ? parseInt(maxDays) : 30;
  const parsedMaxCount = maxCount !== undefined ? parseInt(maxCount) : 100;

  dataAccess.setSnapshotSettings(userId, parsedMaxDays, parsedMaxCount);

  // TODO: Run cleanup with new settings when historical data is implemented

  res.json({
    success: true,
    settings: { maxDays: parsedMaxDays, maxCount: parsedMaxCount },
    dates: []
  });
});

// Export date range (placeholder)
app.post('/api/exports/date-range', authMiddleware, (req, res) => {
  const { startDate, endDate } = req.body;
  const userId = req.user.id;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Start date and end date required' });
  }

  // TODO: Implement historical data retrieval from database
  const exportData = [];

  res.json({ dates: exportData });
});

// Download markdown for date range (as zip with individual files)
app.post('/api/exports/download-range', async (req, res) => {
  const { startDate, endDate, token } = req.body;

  // Verify token from body (form submissions can't set headers)
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const userId = decoded.id;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Start date and end date required' });
  }

  try {
    // Get all snapshots in date range
    const allSnapshots = dataAccess.getSnapshots(userId);
    const snapshotsInRange = allSnapshots.filter(s => s.date >= startDate && s.date <= endDate);

    if (snapshotsInRange.length === 0) {
      return res.status(404).json({ error: 'No snapshots available in this date range' });
    }

    const username = dataAccess.getUserById(userId)?.username;
    const userProfileFields = dataAccess.getProfileFields(userId);

    // Create a zip archive
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="snapshots_${startDate}_to_${endDate}.zip"`);

    archive.pipe(res);

    archive.on('error', (err) => {
      console.error('Archive error:', err);
      throw err;
    });

    // Add each snapshot as individual markdown file
    snapshotsInRange.forEach((snapshotMeta) => {
      const snapshot = dataAccess.getSnapshot(userId, snapshotMeta.date);
      if (snapshot) {
        const markdown = generateMarkdownWithYAML(snapshot, username, userProfileFields);
        archive.append(markdown, { name: `snapshot_${snapshotMeta.date}.md` });
      }
    });

    await archive.finalize();
  } catch (error) {
    console.error('Error generating markdown zip:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate markdown zip', details: error.message });
    }
  }
});

// Download PDF for date range (as zip with individual files)
app.post('/api/exports/download-range-pdf', async (req, res) => {
  const { startDate, endDate, token } = req.body;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const userId = decoded.id;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Start date and end date required' });
  }

  try {
    // Get all snapshots in date range
    const allSnapshots = dataAccess.getSnapshots(userId);
    const snapshotsInRange = allSnapshots.filter(s => s.date >= startDate && s.date <= endDate);

    if (snapshotsInRange.length === 0) {
      return res.status(404).json({ error: 'No snapshots available in this date range' });
    }

    const username = dataAccess.getUserById(userId)?.username;
    const userProfileFields = dataAccess.getProfileFields(userId);

    // Create a zip archive
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="snapshots_${startDate}_to_${endDate}_pdf.zip"`);

    archive.pipe(res);

    archive.on('error', (err) => {
      console.error('Archive error:', err);
      throw err;
    });

    // Generate individual PDF for each snapshot
    for (const snapshotMeta of snapshotsInRange) {
      const snapshot = dataAccess.getSnapshot(userId, snapshotMeta.date);
      if (!snapshot) continue;

      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));

      // Header with purple background
      doc.rect(0, 0, doc.page.width, 100).fillAndStroke('#6B46C1', '#6B46C1');
      doc.fillColor('#FFFFFF')
         .fontSize(24)
         .text('DAILY JOURNAL REPORT', 50, 30, { align: 'center' });
      doc.fontSize(14)
         .text(formatDate(snapshot.date), 50, 60, { align: 'center' });

      doc.fillColor('#000000');
      doc.y = 120;
      doc.moveDown(1);

      // User Information
      if (username) {
        doc.fontSize(16).fillColor('#6B46C1').text('USER INFORMATION', { underline: true });
        doc.fontSize(12).fillColor('#000000').text(`Username: ${username}`);
        doc.moveDown();
      }

      // Profile Fields
      if (userProfileFields && Object.keys(userProfileFields).length > 0) {
        doc.fontSize(16).fillColor('#6B46C1').text('PROFILE FIELDS', { underline: true });
        doc.moveDown(0.5);
        Object.entries(userProfileFields).forEach(([key, value]) => {
          doc.fontSize(12).fillColor('#000000').text(`${key}: ${value}`);
        });
        doc.moveDown();
      }

      // Sleep Metrics
      if (snapshot.previousBedtime || snapshot.wakeTime) {
        doc.fontSize(16).fillColor('#6B46C1').text('SLEEP METRICS', { underline: true });
        doc.moveDown(0.5);
        if (snapshot.previousBedtime) {
          doc.fontSize(12).fillColor('#000000').text(`Bedtime: ${snapshot.previousBedtime}`);
        }
        if (snapshot.wakeTime) {
          doc.fontSize(12).fillColor('#000000').text(`Wake Time: ${snapshot.wakeTime}`);
        }
        doc.moveDown();
      }

      // Time Since Trackers
      if (snapshot.timeSinceTrackers && snapshot.timeSinceTrackers.length > 0) {
        doc.fontSize(16).fillColor('#6B46C1').text('TIME SINCE TRACKERS', { underline: true });
        doc.moveDown(0.5);
        snapshot.timeSinceTrackers.forEach(t => {
          doc.fontSize(12).fillColor('#000000')
             .text(`${t.name}: ${calculateTimeSince(t.date)} (since ${t.date})`);
        });
        doc.moveDown();
      }

      // Duration Trackers
      if (snapshot.durationTrackers && snapshot.durationTrackers.length > 0) {
        doc.fontSize(16).fillColor('#6B46C1').text('DURATION TRACKERS', { underline: true });
        doc.moveDown(0.5);
        snapshot.durationTrackers.forEach(t => {
          if (t.type === 'timer') {
            const formatted = formatDuration(t.value);
            const running = t.isRunning ? ' (RUNNING)' : '';
            doc.fontSize(12).fillColor('#000000').text(`${t.name}: ${formatted}${running}`);
          } else if (t.type === 'counter') {
            doc.fontSize(12).fillColor('#000000').text(`${t.name}: ${t.value} minutes`);
          }
        });
        doc.moveDown();
      }

      // Custom Counters
      if (snapshot.customCounters && snapshot.customCounters.length > 0) {
        doc.fontSize(16).fillColor('#6B46C1').text('CUSTOM COUNTERS', { underline: true });
        doc.moveDown(0.5);
        snapshot.customCounters.forEach(c => {
          doc.fontSize(12).fillColor('#000000').text(`${c.name}: ${c.value}`);
        });
        doc.moveDown();
      }

      // Template Fields
      if (snapshot.customFields && snapshot.customFields.length > 0) {
        doc.fontSize(16).fillColor('#6B46C1').text('TEMPLATE FIELDS', { underline: true });
        doc.moveDown(0.5);
        snapshot.customFields.forEach(f => {
          if (f.value) {
            doc.fontSize(12).fillColor('#000000').text(`${f.key}: ${f.value}`);
          }
        });
        doc.moveDown();
      }

      // Daily Fields
      if (snapshot.dailyCustomFields && snapshot.dailyCustomFields.length > 0) {
        doc.fontSize(16).fillColor('#6B46C1').text('DAILY FIELDS', { underline: true });
        doc.moveDown(0.5);
        snapshot.dailyCustomFields.forEach(f => {
          if (f.value) {
            doc.fontSize(12).fillColor('#000000').text(`${f.key}: ${f.value}`);
          }
        });
        doc.moveDown();
      }

      // Tasks
      if (snapshot.tasks && snapshot.tasks.length > 0) {
        doc.fontSize(16).fillColor('#6B46C1').text('TASKS', { underline: true });
        doc.moveDown(0.5);
        snapshot.tasks.forEach(task => {
          const checkbox = task.completed ? '[✓]' : '[ ]';
          doc.fontSize(12).fillColor('#000000').text(`${checkbox} ${task.text}`);
        });
        doc.moveDown();
      }

      // Activity Entries
      if (snapshot.entries && snapshot.entries.length > 0) {
        doc.fontSize(16).fillColor('#6B46C1').text('ACTIVITY ENTRIES', { underline: true });
        doc.moveDown(0.5);
        snapshot.entries.forEach(entry => {
          doc.fontSize(12).fillColor('#000000')
             .font('Helvetica-Bold').text(entry.timestamp, { continued: false })
             .font('Helvetica').text(entry.text);
          doc.moveDown(0.5);
        });
      }

      doc.end();

      // Wait for PDF to be generated and add to archive
      await new Promise((resolve, reject) => {
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          archive.append(pdfBuffer, { name: `snapshot_${snapshotMeta.date}.pdf` });
          resolve();
        });
        doc.on('error', reject);
      });
    }

    await archive.finalize();
  } catch (error) {
    console.error('Error generating PDF zip:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF zip', details: error.message });
    }
  }
});

// Download CSV for date range
app.post('/api/exports/download-range-csv', async (req, res) => {
  const { startDate, endDate, token } = req.body;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const userId = decoded.id;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Start date and end date required' });
  }

  try {
    // Get all snapshots in date range
    const allSnapshots = dataAccess.getSnapshots(userId);
    const snapshotsInRange = allSnapshots.filter(s => s.date >= startDate && s.date <= endDate);

    if (snapshotsInRange.length === 0) {
      return res.status(404).json({ error: 'No snapshots available in this date range' });
    }

    const username = dataAccess.getUserById(userId)?.username;

    // Build CSV content
    let csv = 'Date,Username,Bedtime,Wake Time,Entry Time,Entry Text,Tasks,Completed Tasks,Time Since Trackers,Duration Trackers,Custom Counters\n';

    snapshotsInRange.forEach((snapshotMeta) => {
      const snapshot = dataAccess.getSnapshot(userId, snapshotMeta.date);
      if (!snapshot) return;

      const date = snapshot.date || '';
      const user = (username || '').replace(/"/g, '""');
      const bedtime = (snapshot.previousBedtime || '').replace(/"/g, '""');
      const wakeTime = (snapshot.wakeTime || '').replace(/"/g, '""');

      // Duration Trackers summary
      let durationTrackersStr = '';
      if (snapshot.durationTrackers && snapshot.durationTrackers.length > 0) {
        durationTrackersStr = snapshot.durationTrackers.map(t => {
          if (t.type === 'timer') {
            return `${t.name}: ${formatDuration(t.value)}`;
          } else {
            return `${t.name}: ${t.value} min`;
          }
        }).join('; ');
      }

      // Time Since Trackers summary
      let timeSinceStr = '';
      if (snapshot.timeSinceTrackers && snapshot.timeSinceTrackers.length > 0) {
        timeSinceStr = snapshot.timeSinceTrackers.map(t =>
          `${t.name}: ${calculateTimeSince(t.date)}`
        ).join('; ');
      }

      // Custom Counters summary
      let customCountersStr = '';
      if (snapshot.customCounters && snapshot.customCounters.length > 0) {
        customCountersStr = snapshot.customCounters.map(c =>
          `${c.name}: ${c.value}`
        ).join('; ');
      }

      // Tasks summary
      let tasksStr = '';
      let completedTasksStr = '';
      if (snapshot.tasks && snapshot.tasks.length > 0) {
        tasksStr = snapshot.tasks.length.toString();
        completedTasksStr = snapshot.tasks.filter(t => t.completed).length.toString();
      }

      // Add rows for each entry
      if (snapshot.entries && snapshot.entries.length > 0) {
        snapshot.entries.forEach(entry => {
          const timestamp = (entry.timestamp || '').replace(/"/g, '""');
          const text = (entry.text || '').replace(/"/g, '""').replace(/\n/g, ' ');
          csv += `"${date}","${user}","${bedtime}","${wakeTime}","${timestamp}","${text}","${tasksStr}","${completedTasksStr}","${timeSinceStr}","${durationTrackersStr}","${customCountersStr}"\n`;
        });
      } else {
        // No entries, still include snapshot metadata
        csv += `"${date}","${user}","${bedtime}","${wakeTime}","","","${tasksStr}","${completedTasksStr}","${timeSinceStr}","${durationTrackersStr}","${customCountersStr}"\n`;
      }
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="snapshots_${startDate}_to_${endDate}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error generating CSV:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate CSV', details: error.message });
    }
  }
});

// Download multiple snapshots as a zip file
app.post('/api/exports/download-zip', async (req, res) => {
  const { dates, fileType, token } = req.body; // dates is an array of date strings

  console.log('Zip download request:', {
    hasDates: !!dates,
    isArray: Array.isArray(dates),
    datesLength: dates?.length,
    fileType,
    hasToken: !!token
  });

  if (!token || !dates || !Array.isArray(dates) || dates.length === 0) {
    console.error('Validation failed:', { token: !!token, dates, isArray: Array.isArray(dates) });
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  let userId;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    userId = decoded.id;
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const username = dataAccess.getUserById(userId)?.username;
    const userProfileFields = dataAccess.getProfileFields(userId);

    // Create a zip archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="snapshots_${dates.length}_files.zip"`);

    // Pipe archive to response
    archive.pipe(res);

    // Handle archive errors
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      throw err;
    });

    // Generate CSV if requested
    if (fileType === 'csv' || fileType === 'all') {
      let csv = 'Date,Username,Bedtime,Wake Time,Entry Time,Entry Text,Tasks,Completed Tasks,Time Since Trackers,Duration Trackers,Custom Counters\n';

      dates.forEach(date => {
        const snapshot = dataAccess.getSnapshot(userId, date);
        if (!snapshot) return;

        const user = (username || '').replace(/"/g, '""');
        const bedtime = (snapshot.previousBedtime || '').replace(/"/g, '""');
        const wakeTime = (snapshot.wakeTime || '').replace(/"/g, '""');

        // Duration Trackers summary
        let durationTrackersStr = '';
        if (snapshot.durationTrackers && snapshot.durationTrackers.length > 0) {
          durationTrackersStr = snapshot.durationTrackers.map(t => {
            if (t.type === 'timer') {
              return `${t.name}: ${formatDuration(t.value)}`;
            } else {
              return `${t.name}: ${t.value} min`;
            }
          }).join('; ');
        }

        // Time Since Trackers summary
        let timeSinceStr = '';
        if (snapshot.timeSinceTrackers && snapshot.timeSinceTrackers.length > 0) {
          timeSinceStr = snapshot.timeSinceTrackers.map(t =>
            `${t.name}: ${calculateTimeSince(t.date)}`
          ).join('; ');
        }

        // Custom Counters summary
        let customCountersStr = '';
        if (snapshot.customCounters && snapshot.customCounters.length > 0) {
          customCountersStr = snapshot.customCounters.map(c =>
            `${c.name}: ${c.value}`
          ).join('; ');
        }

        // Tasks summary
        let tasksStr = '';
        let completedTasksStr = '';
        if (snapshot.tasks && snapshot.tasks.length > 0) {
          tasksStr = snapshot.tasks.length.toString();
          completedTasksStr = snapshot.tasks.filter(t => t.completed).length.toString();
        }

        // Add rows for each entry
        if (snapshot.entries && snapshot.entries.length > 0) {
          snapshot.entries.forEach(entry => {
            const timestamp = (entry.timestamp || '').replace(/"/g, '""');
            const text = (entry.text || '').replace(/"/g, '""').replace(/\n/g, ' ');
            csv += `"${date}","${user}","${bedtime}","${wakeTime}","${timestamp}","${text}","${tasksStr}","${completedTasksStr}","${timeSinceStr}","${durationTrackersStr}","${customCountersStr}"\n`;
          });
        } else {
          // No entries, still include snapshot metadata
          csv += `"${date}","${user}","${bedtime}","${wakeTime}","","","${tasksStr}","${completedTasksStr}","${timeSinceStr}","${durationTrackersStr}","${customCountersStr}"\n`;
        }
      });

      archive.append(csv, { name: `snapshots_combined.csv` });
    }

    // Add each snapshot to the archive
    for (const date of dates) {
      const snapshot = dataAccess.getSnapshot(userId, date);
      if (!snapshot) {
        console.log(`Snapshot not found for date: ${date}`);
        continue;
      }

      if (fileType === 'markdown' || fileType === 'all') {
        const markdown = generateMarkdownWithYAML(snapshot, username, userProfileFields);
        archive.append(markdown, { name: `snapshot_${date}.md` });
      }

      if (fileType === 'pdf' || fileType === 'all') {
        // Generate PDF for this snapshot
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));

        // PDF generation (same as single PDF export)
        doc.fontSize(24).text(`Daily Journal - ${date}`, { align: 'center' });
        doc.moveDown();
        const settings = dataAccess.getUserSettings(userId);
        const timezone = settings?.timezone || 'UTC';
        const generatedDate = formatInTimeZone(new Date(), timezone, 'MMM dd, yyyy HH:mm');
        doc.fontSize(10).text(`Generated on ${generatedDate}`, { align: 'center' });
        doc.moveDown(2);

        // Profile Fields
        if (userProfileFields && userProfileFields.length > 0) {
          doc.fontSize(16).fillColor('#2563eb').text('Profile Information', { underline: true });
          doc.moveDown(0.5);
          doc.fontSize(12).fillColor('#000000');
          userProfileFields.forEach(field => {
            doc.text(`${field.key}: ${field.value}`, { indent: 20 });
          });
          doc.moveDown();
        }

        // Custom Fields
        if (snapshot.customFields && snapshot.customFields.length > 0) {
          doc.fontSize(16).fillColor('#2563eb').text('Daily Fields', { underline: true });
          doc.moveDown(0.5);
          doc.fontSize(12).fillColor('#000000');
          snapshot.customFields.forEach(field => {
            doc.text(`${field.key}: ${field.value || '—'}`, { indent: 20 });
          });
          doc.moveDown();
        }

        // Sleep
        if (snapshot.previousBedtime || snapshot.wakeTime) {
          doc.fontSize(16).fillColor('#2563eb').text('Sleep', { underline: true });
          doc.moveDown(0.5);
          doc.fontSize(12).fillColor('#000000');
          if (snapshot.previousBedtime) {
            doc.text(`Bedtime: ${snapshot.previousBedtime}`, { indent: 20 });
          }
          if (snapshot.wakeTime) {
            doc.text(`Wake Time: ${snapshot.wakeTime}`, { indent: 20 });
          }
          doc.moveDown();
        }

        // Tasks
        if (snapshot.dailyTasks && snapshot.dailyTasks.length > 0) {
          doc.fontSize(16).fillColor('#2563eb').text('Tasks', { underline: true });
          doc.moveDown(0.5);
          doc.fontSize(12).fillColor('#000000');
          snapshot.dailyTasks.forEach(task => {
            const status = task.completed ? '✓' : '○';
            doc.text(`${status} ${task.text}`, { indent: 20 });
          });
          doc.moveDown();
        }

        // Activity Log
        if (snapshot.entries && snapshot.entries.length > 0) {
          doc.fontSize(16).fillColor('#2563eb').text('Activity Log', { underline: true });
          doc.moveDown(0.5);
          doc.fontSize(12).fillColor('#000000');
          snapshot.entries.forEach(entry => {
            const time = entry.timestamp ? formatInTimeZone(new Date(entry.timestamp), timezone, 'HH:mm:ss') : '';
            doc.text(`[${time}] ${entry.text}`, { indent: 20 });
          });
          doc.moveDown();
        }

        // Time Since Trackers
        if (snapshot.timeSinceTrackers && snapshot.timeSinceTrackers.length > 0) {
          doc.fontSize(16).fillColor('#2563eb').text('Time Since Trackers', { underline: true });
          doc.moveDown(0.5);
          doc.fontSize(12).fillColor('#000000');
          snapshot.timeSinceTrackers.forEach(tracker => {
            doc.text(`${tracker.name}: ${tracker.date}`, { indent: 20 });
          });
          doc.moveDown();
        }

        // Duration Trackers
        if (snapshot.durationTrackers && snapshot.durationTrackers.length > 0) {
          doc.fontSize(16).fillColor('#2563eb').text('Duration Trackers', { underline: true });
          doc.moveDown(0.5);
          doc.fontSize(12).fillColor('#000000');
          snapshot.durationTrackers.forEach(tracker => {
            const hours = Math.floor(tracker.elapsed_ms / 3600000);
            const minutes = Math.floor((tracker.elapsed_ms % 3600000) / 60000);
            const seconds = Math.floor((tracker.elapsed_ms % 60000) / 1000);
            doc.text(`${tracker.name}: ${hours}h ${minutes}m ${seconds}s`, { indent: 20 });
          });
          doc.moveDown();
        }

        // Counters
        if (snapshot.customCounters && snapshot.customCounters.length > 0) {
          doc.fontSize(16).fillColor('#2563eb').text('Counters', { underline: true });
          doc.moveDown(0.5);
          doc.fontSize(12).fillColor('#000000');
          snapshot.customCounters.forEach(counter => {
            doc.text(`${counter.name}: ${counter.value}`, { indent: 20 });
          });
          doc.moveDown();
        }

        doc.end();

        // Wait for PDF to be generated and add to archive
        await new Promise((resolve, reject) => {
          doc.on('end', () => {
            const pdfBuffer = Buffer.concat(buffers);
            archive.append(pdfBuffer, { name: `snapshot_${date}.pdf` });
            resolve();
          });
          doc.on('error', reject);
        });
      }
    }

    // Finalize the archive
    await archive.finalize();
  } catch (error) {
    console.error('Error generating zip:', error);
    res.status(500).json({ error: 'Failed to generate zip file', details: error.message });
  }
});

// Tracker endpoints
app.post('/api/trackers/time-since', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { name, date } = req.body;

  // Create tracker in database
  dataAccess.createTimeSinceTracker(userId, name, date);

  // Invalidate cache to ensure fresh data is returned
  invalidateUserCache(userId);

  const state = getUserState(userId);
  res.json(state);
});

app.delete('/api/trackers/time-since/:id', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);

  // Delete from database
  dataAccess.deleteTimeSinceTracker(id);

  // Invalidate cache to ensure fresh data is returned
  invalidateUserCache(userId);

  const state = getUserState(userId);
  res.json(state);
});

app.post('/api/trackers/duration', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { name } = req.body;

  // Create tracker in database
  dataAccess.createDurationTracker(userId, name);

  // Invalidate cache to ensure fresh data is returned
  invalidateUserCache(userId);

  const state = getUserState(userId);
  res.json(state);
});

app.delete('/api/trackers/duration/:id', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);

  // Delete from database
  dataAccess.deleteDurationTracker(id);

  // Invalidate cache to ensure fresh data is returned
  invalidateUserCache(userId);

  const state = getUserState(userId);
  res.json(state);
});

// Set manual time for timer
app.post('/api/trackers/manual-time', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { trackerId, startTime, elapsedMs } = req.body;

  // Update tracker in database
  dataAccess.updateDurationTracker(parseInt(trackerId), {
    startTime: startTime,
    elapsedMs: elapsedMs,
    isRunning: false
  });

  console.log(`Set manual time for tracker ${trackerId}: ${elapsedMs}ms`);

  const state = getUserState(userId);
  res.json(state);
});

app.post('/api/trackers/timer/start/:id', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);

  // Update tracker in database - auto-unlock when starting
  dataAccess.updateDurationTracker(id, {
    isRunning: true,
    isLocked: false, // Auto-unlock when starting
    startTime: new Date().toISOString()
  });

  invalidateUserCache(userId);
  const state = getUserState(userId);
  res.json(state);
});

// Pause timer (stops without locking, allows resume)
app.post('/api/trackers/timer/pause/:id', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);

  // Get current tracker state
  const trackers = dataAccess.getDurationTrackers(userId);
  const tracker = trackers.find(t => t.id === id);

  if (tracker && tracker.type === 'timer' && tracker.isRunning) {
    const elapsed = Date.now() - new Date(tracker.startTime).getTime();
    const newElapsedMs = (tracker.elapsedMs || 0) + elapsed;
    const newValue = Math.floor(newElapsedMs / 1000);

    dataAccess.updateDurationTracker(id, {
      elapsedMs: newElapsedMs,
      value: newValue,
      isRunning: false,
      isLocked: false, // Paused but NOT locked - allows resume
      startTime: null
    });
  }

  invalidateUserCache(userId);
  const state = getUserState(userId);
  res.json(state);
});

// Toggle lock state (stop/unlock toggle)
app.post('/api/trackers/timer/toggle-lock/:id', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);

  const trackers = dataAccess.getDurationTrackers(userId);
  const tracker = trackers.find(t => t.id === id);

  if (tracker && tracker.type === 'timer') {
    const newLockedState = !tracker.isLocked;

    // If running, pause first
    let updates = {
      isLocked: newLockedState,
      isRunning: false // Ensure not running when toggling lock
    };

    // Calculate elapsed time if currently running
    if (tracker.isRunning) {
      const elapsed = Date.now() - new Date(tracker.startTime).getTime();
      const newElapsedMs = (tracker.elapsedMs || 0) + elapsed;
      const newValue = Math.floor(newElapsedMs / 1000);
      updates.elapsedMs = newElapsedMs;
      updates.value = newValue;
      updates.startTime = null;
    }

    // If locking, create activity log
    if (newLockedState) {
      const settings = dataAccess.getUserSettings(userId);
      const timezone = settings?.timezone || 'UTC';
      const completedTime = formatInTimeZone(new Date(), timezone, 'HH:mm:ss');
      const finalValue = updates.value || tracker.value || 0;
      const formattedElapsed = formatElapsedTime(finalValue);
      const logText = `Stopped "${tracker.name}" timer (elapsed: ${formattedElapsed}, completed at: ${completedTime})`;
      const currentDate = getCurrentDateInUserTimezone(userId);
      dataAccess.createActivityEntry(userId, currentDate, logText);
    }

    dataAccess.updateDurationTracker(id, updates);
  }

  invalidateUserCache(userId);
  const state = getUserState(userId);
  res.json(state);
});

// Adjust timer time by adding/subtracting milliseconds
app.post('/api/trackers/timer/adjust-time/:id', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);
  const { adjustmentMs } = req.body;

  if (!adjustmentMs || isNaN(adjustmentMs)) {
    return res.status(400).json({ error: 'Invalid adjustment value' });
  }

  const trackers = dataAccess.getDurationTrackers(userId);
  const tracker = trackers.find(t => t.id === id);

  if (tracker && tracker.type === 'timer') {
    if (tracker.isRunning) {
      // Timer is running: adjust startTime to maintain continuity
      const currentElapsed = Date.now() - new Date(tracker.startTime).getTime();
      const totalElapsed = (tracker.elapsedMs || 0) + currentElapsed;
      const newElapsed = Math.max(0, totalElapsed + adjustmentMs);

      // Calculate new startTime to maintain continuity
      const newStartTime = new Date(Date.now() - (newElapsed - (tracker.elapsedMs || 0))).toISOString();

      dataAccess.updateDurationTracker(id, {
        startTime: newStartTime
      });
    } else {
      // Timer is paused/stopped: adjust elapsedMs directly
      const newElapsedMs = Math.max(0, (tracker.elapsedMs || 0) + adjustmentMs);
      const newValue = Math.floor(newElapsedMs / 1000);

      dataAccess.updateDurationTracker(id, {
        elapsedMs: newElapsedMs,
        value: newValue
      });
    }
  }

  invalidateUserCache(userId);
  const state = getUserState(userId);
  res.json(state);
});

app.post('/api/trackers/timer/stop/:id', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);

  // Get current tracker state
  const trackers = dataAccess.getDurationTrackers(userId);
  const tracker = trackers.find(t => t.id === id);

  if (tracker && tracker.type === 'timer' && tracker.isRunning) {
    const elapsed = Date.now() - new Date(tracker.startTime).getTime();
    const newElapsedMs = (tracker.elapsedMs || 0) + elapsed;
    const newValue = Math.floor(newElapsedMs / 1000);

    dataAccess.updateDurationTracker(id, {
      elapsedMs: newElapsedMs,
      value: newValue,
      isRunning: false,
      isLocked: true, // Lock timer when stopped
      startTime: null
    });

    // Create log entry for timer stop
    const settings = dataAccess.getUserSettings(userId);
    const timezone = settings?.timezone || 'UTC';
    const completedTime = formatInTimeZone(new Date(), timezone, 'HH:mm:ss');
    const formattedElapsed = formatElapsedTime(newValue);
    const logText = `Stopped "${tracker.name}" timer (elapsed: ${formattedElapsed}, completed at: ${completedTime})`;
    const currentDate = getCurrentDateInUserTimezone(userId);
    dataAccess.createActivityEntry(userId, currentDate, logText);
  }

  const state = getUserState(userId);
  res.json(state);
});

app.post('/api/trackers/timer/reset/:id', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);

  // Reset tracker in database and unlock it
  dataAccess.updateDurationTracker(id, {
    value: 0,
    isRunning: false,
    isLocked: false, // Unlock when resetting
    startTime: null,
    elapsedMs: 0
  });

  const state = getUserState(userId);
  res.json(state);
});

// Custom Counters (water, coffee, calories, etc.)
app.post('/api/custom-counters/create', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Counter name is required' });
  }

  // Create counter in database
  dataAccess.createCustomCounter(userId, name);

  // Invalidate cache to ensure fresh data is returned
  invalidateUserCache(userId);

  const state = getUserState(userId);
  res.json(state);
});

app.post('/api/custom-counters/:id/increment', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);
  const currentDate = getCurrentDateInUserTimezone(userId);

  // Get current value and increment
  const currentValue = dataAccess.getCustomCounterValue(id, currentDate);
  const newValue = currentValue + 1;
  dataAccess.setCustomCounterValue(id, userId, currentDate, newValue);

  // Create log entry for counter increment
  const counterName = db.prepare('SELECT name FROM custom_counters WHERE id = ? AND user_id = ?').get(id, userId);
  if (counterName) {
    const logText = `Added 1 to "${counterName.name}" counter (now at ${newValue})`;
    dataAccess.createActivityEntry(userId, currentDate, logText);
  }

  // Invalidate cache to ensure fresh data is returned
  invalidateUserCache(userId);

  const state = getUserState(userId);
  res.json(state);
});

app.post('/api/custom-counters/:id/decrement', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);
  const currentDate = getCurrentDateInUserTimezone(userId);

  // Get current value and decrement (don't go below 0)
  const currentValue = dataAccess.getCustomCounterValue(id, currentDate);
  const counterName = db.prepare('SELECT name FROM custom_counters WHERE id = ? AND user_id = ?').get(id, userId);
  const newValue = currentValue > 0 ? currentValue - 1 : 0;
  
  if (currentValue > 0) {
    dataAccess.setCustomCounterValue(id, userId, currentDate, newValue);

    // Create log entry for counter decrement
    const logText = `Removed 1 from "${counterName.name}" counter (now at ${newValue})`;
    dataAccess.createActivityEntry(userId, currentDate, logText);
  }

  // Invalidate cache to ensure fresh data is returned
  invalidateUserCache(userId);

  const state = getUserState(userId);
  res.json(state);
});

app.put('/api/custom-counters/:id/set', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);
  const { value } = req.body;
  const currentDate = getCurrentDateInUserTimezone(userId);

  if (typeof value === 'number' && value >= 0) {
    const counterName = db.prepare('SELECT name FROM custom_counters WHERE id = ? AND user_id = ?').get(id, userId);
    const oldValue = dataAccess.getCustomCounterValue(id, currentDate);
    
    dataAccess.setCustomCounterValue(id, userId, currentDate, value);
    
    // Create log entry for counter change (only if value actually changed)
    if (oldValue !== value) {
      const change = value > oldValue ? `added ${value - oldValue}` : `removed ${oldValue - value}`;
      const logText = `Set "${counterName.name}" counter to ${value} (${change})`;
      dataAccess.createActivityEntry(userId, currentDate, logText);
    }
  }

  // Invalidate cache to ensure fresh data is returned
  invalidateUserCache(userId);

  const state = getUserState(userId);
  res.json(state);
});

app.delete('/api/custom-counters/:id', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);

  // Delete from database
  dataAccess.deleteCustomCounter(id);

  // Invalidate cache to ensure fresh data is returned
  invalidateUserCache(userId);

  const state = getUserState(userId);
  res.json(state);
});

// Daily Custom Fields (non-persistent, don't carry over to new dates)
app.post('/api/daily-custom-fields', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { key, value } = req.body;

  if (!key) {
    return res.status(400).json({ error: 'Field key is required' });
  }

  const currentDate = getCurrentDateInUserTimezone(userId);

  // Set daily custom field in database (isTemplate = false)
  dataAccess.setDailyCustomField(userId, currentDate, key, value || '', false);

  const state = getUserState(userId);
  res.json(state);
});

app.delete('/api/daily-custom-fields/:id', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);

  // Delete from database
  dataAccess.deleteDailyCustomFieldById(id);

  const state = getUserState(userId);
  res.json(state);
});

// Daily Tasks
app.post('/api/daily-tasks', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { text, dueDate, details, parentTaskId, points } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Task text is required' });
  }

  const currentDate = getCurrentDateInUserTimezone(userId);

  // Create task in database
  const taskId = dataAccess.createDailyTask(
    userId,
    currentDate,
    text,
    dueDate || currentDate,
    details,
    parentTaskId,
    false, // pinned
    false, // recurring
    points || 0
  );

  // If details are provided, create a log entry and link it
  if (details && details.trim()) {
    let logText = `created a task: ${text}`;
    if (details) logText += `\n${details}`;
    if (dueDate && dueDate !== currentDate) logText += `\nDue: ${dueDate}`;

    const logEntryId = dataAccess.createActivityEntry(userId, currentDate, logText);
    dataAccess.updateDailyTask(taskId, { logEntryId });
  }

  const state = getUserState(userId);
  res.json(state);
});

app.put('/api/daily-tasks/:id', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);
  const { text, dueDate, details, pinned, recurring, points } = req.body;

  const updates = {};
  if (text !== undefined) updates.text = text;
  if (dueDate !== undefined) updates.dueDate = dueDate;
  if (details !== undefined) updates.details = details;
  if (pinned !== undefined) updates.pinned = pinned;
  if (recurring !== undefined) updates.recurring = recurring;
  if (points !== undefined) updates.points = points;

  // Update task in database
  dataAccess.updateDailyTask(id, updates);

  // If details were updated and not empty, create or update log entry
  if (details !== undefined && details.trim()) {
    const allTasks = dataAccess.getDailyTasks(userId);
    const task = allTasks.find(t => t.id === id);
    if (task) {
      const currentDate = getCurrentDateInUserTimezone(userId);

      let logText = `updated task: ${task.text}`;
      if (details) logText += `\n${details}`;
      if (task.dueDate && task.dueDate !== currentDate) logText += `\nDue: ${task.dueDate}`;

      const logEntryId = dataAccess.createActivityEntry(userId, currentDate, logText);
      dataAccess.updateDailyTask(id, { logEntryId });
    }
  }

  const state = getUserState(userId);
  res.json(state);
});

app.put('/api/daily-tasks/:id/toggle', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);

  // Toggle task in database and get updated task data
  const task = dataAccess.toggleDailyTask(id);

  // If task was just marked complete, create a log entry
  if (task && task.done === 1) {
    const currentDate = getCurrentDateInUserTimezone(userId);
    const completedDate = task.completedAt ? task.completedAt.slice(0, 10) : currentDate;

    let logText;
    if (task.is_reward) {
      // Special message for reward tickets
      logText = `🎁 Reward Used: ${task.text.replace('🎁 ', '')}`;
      if (task.details) {
        logText += `\n${task.details}`;
      }
      logText += `\nUsed: ${completedDate}`;
    } else {
      // Regular task completion message
      logText = `Completed a Task: ${task.text}`;
      if (task.due_date) {
        logText += `\nDue: ${task.due_date}`;
      }
      logText += `\nCompleted: ${completedDate}`;
    }

    dataAccess.createActivityEntry(userId, currentDate, logText);
  }

  const state = getUserState(userId);
  res.json(state);
});

app.put('/api/daily-tasks/:id/toggle-pinned', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);

  // Get current task to toggle pinned status
  const task = dataAccess.getDailyTasks(userId).find(t => t.id === id);
  if (task) {
    const newPinned = !task.pinned;
    dataAccess.updateDailyTask(id, { pinned: newPinned });
  }

  const state = getUserState(userId);
  res.json(state);
});

app.put('/api/daily-tasks/:id/toggle-recurring', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);

  // Get current task to toggle recurring status
  const task = dataAccess.getDailyTasks(userId).find(t => t.id === id);
  if (task) {
    const newRecurring = !task.recurring;
    dataAccess.updateDailyTask(id, { recurring: newRecurring });
  }

  const state = getUserState(userId);
  res.json(state);
});

app.delete('/api/daily-tasks/:id', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);

  // Delete from database
  dataAccess.deleteDailyTask(id);

  const state = getUserState(userId);
  res.json(state);
});

// Template Custom Fields (persist name, reset value daily)
app.post('/api/custom-field-templates/create', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { key, fieldType } = req.body;

  if (!key) {
    return res.status(400).json({ error: 'Field key is required' });
  }

  // Validate field type
  const type = fieldType || 'text';
  if (!['text', 'number', 'currency', 'date', 'time', 'datetime', 'boolean'].includes(type)) {
    return res.status(400).json({ error: 'Invalid field type. Must be "text", "number", "currency", "date", "time", "datetime", or "boolean"' });
  }

  // Check if template already exists for this user
  const existingTemplates = dataAccess.getCustomFieldTemplates(userId);
  if (existingTemplates.find(t => t.key === key)) {
    return res.status(400).json({ error: 'Template already exists' });
  }

  try {
    // Create template in database with field type
    const templateId = dataAccess.createCustomFieldTemplate(userId, key, type);

    // Add to current day's custom fields with empty value
    const currentDate = getCurrentDateInUserTimezone(userId);
    dataAccess.setDailyCustomField(userId, currentDate, key, '', true, type);

    const templates = dataAccess.getCustomFieldTemplates(userId);
    const state = getUserState(userId);
    res.json({ templates, state });
  } catch (error) {
    console.error('Error creating custom field template:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/custom-field-templates', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const templates = dataAccess.getCustomFieldTemplates(userId);
  res.json({ templates });
});

app.delete('/api/custom-field-templates/:id', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);

  const state = getUserState(userId);

  // Find the custom field by its ID to get the key
  const customField = state.customFields.find(f => f.id === id);

  if (customField) {
    const key = customField.key;

    // Remove template from database
    dataAccess.deleteCustomFieldTemplate(userId, key);

    // Remove from current day's custom fields
    const currentDate = getCurrentDateInUserTimezone(userId);
    dataAccess.deleteDailyCustomField(userId, currentDate, key);
  }

  const templates = dataAccess.getCustomFieldTemplates(userId);
  const updatedState = getUserState(userId);
  res.json({ templates, state: updatedState });
});

// Update template field type
app.put('/api/custom-field-templates/:id', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);
  const { field_type } = req.body;

  if (!field_type || !['text', 'number', 'currency', 'date', 'time', 'datetime', 'boolean'].includes(field_type)) {
    return res.status(400).json({ error: 'Invalid field type' });
  }

  dataAccess.updateCustomFieldTemplate(id, { fieldType: field_type });
  
  const state = getUserState(userId);
  res.json({ state });
});

// Update template-based custom field value (updates current day only, or specific date if provided)
app.put('/api/custom-fields/:key', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { key } = req.params;
  const { value, date } = req.body;

  // URL decode the key to handle spaces and special characters
  const decodedKey = decodeURIComponent(key);

  // Use provided date or current date
  const targetDate = date || getCurrentDateInUserTimezone(userId);

  // Get field type from template
  const template = dataAccess.getCustomFieldTemplate(userId, decodedKey);
  const fieldType = template ? template.field_type : 'text';

  // Invalidate cache BEFORE reading old value to ensure fresh data
  invalidateUserCache(userId, targetDate);

  // For boolean fields, get the old value BEFORE updating
  let oldValue = null;
  if (fieldType === 'boolean') {
    try {
      const dailyFields = dataAccess.getDailyCustomFields(userId, targetDate);
      const currentField = dailyFields.find(f => f.key === decodedKey);
      // Convert to string, checking for both boolean and string 'true'
      oldValue = currentField ? (currentField.value === 'true' || currentField.value === true ? 'true' : 'false') : 'false';
    } catch (error) {
      console.error('Error getting old boolean field value:', error);
      oldValue = 'false'; // Default to false if error
    }
  }

  // Update field value in database
  dataAccess.setDailyCustomField(userId, targetDate, decodedKey, value, true);

  // Create log entry for boolean field changes
  if (fieldType === 'boolean' && oldValue !== null) {
    try {
      const newValue = value ? 'true' : 'false';

      console.log(`Boolean field change: ${decodedKey}, fieldType: ${fieldType}, oldValue: ${oldValue}, newValue: ${newValue}`);

      if (oldValue !== newValue) {
        const change = newValue === 'true' ? 'checked' : 'unchecked';
        const logText = `Changed "${decodedKey}" field to ${change}`;
        console.log(`Creating log entry: ${logText}`);
        dataAccess.createActivityEntry(userId, targetDate, logText);
      }
    } catch (error) {
      console.error('Error creating boolean field log entry:', error);
    }
  }

  // Return state for the target date
  const state = getUserStateForDate(userId, targetDate);
  res.json(state);
});

// ============================================================================
// QUERIES AND DATA EXPORT ENDPOINTS
// ============================================================================

// Get all populated fields in a date range
app.post('/api/queries/populated-fields', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { startDate, endDate } = req.body;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Start date and end date required' });
  }

  try {
    const fields = dataAccess.getPopulatedFieldsInRange(userId, startDate, endDate);
    res.json({ fields });
  } catch (error) {
    console.error('Error getting populated fields:', error);
    res.status(500).json({ error: error.message });
  }
});

// Query tasks with filters
app.post('/api/queries/tasks', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { startDate, endDate, completionStatus, groupBy } = req.body;

  // Validate date range
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Start date and end date required' });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) {
    return res.status(400).json({ error: 'End date must be after start date' });
  }

  try {
    const queryData = dataAccess.queryTasks(
      userId,
      startDate,
      endDate,
      completionStatus || 'all',
      groupBy || 'none'
    );

    res.json(queryData);
  } catch (error) {
    console.error('Error querying tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Query numeric field analytics (supports single or multiple fields)
app.post('/api/queries/fields', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { fieldKey, fieldKeys, startDate, endDate, groupBy } = req.body;

  // Support both single field (fieldKey) and multiple fields (fieldKeys)
  const keysToQuery = fieldKeys || (fieldKey ? [fieldKey] : []);

  // Validate inputs
  if (!keysToQuery || keysToQuery.length === 0) {
    return res.status(400).json({ error: 'At least one field key is required' });
  }

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Start date and end date required' });
  }

  // Validate date range
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) {
    return res.status(400).json({ error: 'End date must be after start date' });
  }

  try {
    console.log(`Querying ${keysToQuery.length} field(s):`, keysToQuery, `userId: ${userId}, startDate: ${startDate}, endDate: ${endDate}`);

    // Query all fields
    const fieldsData = keysToQuery.map(key => {
      try {
        const values = dataAccess.queryFieldValues(userId, key, startDate, endDate);
        console.log(`Field "${key}" returned ${values.length} values`);

        // Get field type from first value if available
        const fieldType = values.length > 0 && values[0].fieldType ? values[0].fieldType : 'number';

        if (values.length === 0) {
          return {
            fieldKey: key,
            fieldType,
            data: [],
            summary: {
              overall_min: null,
              overall_max: null,
              overall_avg: null,
              overall_sum: null,
              total_count: 0,
              trend: 'no data',
              change_percent: 0
            }
          };
        }

        const aggregatedData = dataAccess.calculateFieldAggregations(values, groupBy || 'day', fieldType);
        const summary = dataAccess.calculateFieldSummary(values, fieldType);

        return {
          fieldKey: key,
          fieldType,
          data: aggregatedData,
          summary
        };
      } catch (err) {
        console.error(`Error querying field "${key}":`, err);
        return {
          fieldKey: key,
          error: err.message,
          data: [],
          summary: null
        };
      }
    });

    // For backward compatibility, if single field, return old format
    if (keysToQuery.length === 1) {
      res.json(fieldsData[0]);
    } else {
      // Multiple fields - calculate combined statistics
      // Build a map of date -> sum of all fields
      const dateMap = new Map();
      const allValues = [];

      fieldsData.forEach(fieldData => {
        if (fieldData.data && fieldData.data.length > 0) {
          fieldData.data.forEach(item => {
            const date = item.date || item.period;
            const value = parseFloat(item.avg || item.value || 0);

            if (!dateMap.has(date)) {
              dateMap.set(date, { date, values: [] });
            }
            dateMap.get(date).values.push(value);
            allValues.push(value);
          });
        }
      });

      // Calculate combined data per date (sum of all fields)
      const combinedData = Array.from(dateMap.values()).map(item => ({
        date: item.date,
        value: item.values.reduce((sum, v) => sum + v, 0), // Sum across all fields
        count: item.values.length // Number of fields with data
      })).sort((a, b) => a.date.localeCompare(b.date));

      // Calculate combined summary statistics
      const combinedSummary = {
        overall_min: allValues.length > 0 ? Math.min(...allValues) : null,
        overall_max: allValues.length > 0 ? Math.max(...allValues) : null,
        overall_avg: allValues.length > 0 ? allValues.reduce((sum, v) => sum + v, 0) / allValues.length : null,
        overall_sum: combinedData.reduce((sum, item) => sum + item.value, 0), // Sum of all combined values
        total_count: keysToQuery.length, // Number of fields selected
        field_count: keysToQuery.length,
        data_points: allValues.length,
        trend: 'stable',
        change_percent: 0
      };

      // Calculate trend and change
      if (combinedData.length >= 2) {
        const sortedValues = combinedData.map(d => d.value).sort((a, b) => b - a);
        const highest = sortedValues[0];
        const secondHighest = sortedValues[1] || highest;

        combinedSummary.change_percent = secondHighest !== 0
          ? ((highest - secondHighest) / secondHighest) * 100
          : 0;

        // Determine trend
        const firstHalf = combinedData.slice(0, Math.floor(combinedData.length / 2));
        const secondHalf = combinedData.slice(Math.floor(combinedData.length / 2));
        const firstAvg = firstHalf.reduce((sum, d) => sum + d.value, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, d) => sum + d.value, 0) / secondHalf.length;

        if (secondAvg > firstAvg * 1.05) {
          combinedSummary.trend = 'increasing';
        } else if (secondAvg < firstAvg * 0.95) {
          combinedSummary.trend = 'decreasing';
        }
      }

      res.json({
        fields: fieldsData,
        fieldKeys: keysToQuery,
        combined: {
          data: combinedData,
          summary: combinedSummary
        }
      });
    }
  } catch (error) {
    console.error('Error querying fields:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get populated counters in date range
app.post('/api/queries/populated-counters', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { startDate, endDate } = req.body;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Start date and end date required' });
  }

  try {
    const counters = dataAccess.getPopulatedCountersInRange(userId, startDate, endDate);
    res.json({ counters });
  } catch (error) {
    console.error('Error getting populated counters:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get populated timers in date range
app.post('/api/queries/populated-timers', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { startDate, endDate } = req.body;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Start date and end date required' });
  }

  try {
    const timers = dataAccess.getPopulatedTimersInRange(userId, startDate, endDate);
    res.json({ timers });
  } catch (error) {
    console.error('Error getting populated timers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Query counters
app.post('/api/queries/counters', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { counterName, counterNames, startDate, endDate, groupBy } = req.body;

  // Support both single counter and multiple counters
  const namesToQuery = counterNames || (counterName ? [counterName] : []);

  // Validate inputs
  if (!namesToQuery || namesToQuery.length === 0) {
    return res.status(400).json({ error: 'At least one counter name is required' });
  }

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Start date and end date required' });
  }

  // Validate date range
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) {
    return res.status(400).json({ error: 'End date must be after start date' });
  }

  try {
    // Query all counters
    const countersData = namesToQuery.map(name => {
      try {
        const values = dataAccess.queryCounterValues(userId, name, startDate, endDate);

        if (values.length === 0) {
          return {
            counterName: name,
            data: [],
            summary: dataAccess.calculateTrackerSummary([])
          };
        }

        const aggregatedData = dataAccess.calculateTrackerAggregations(values, groupBy || 'day');
        const summary = dataAccess.calculateTrackerSummary(values);

        return {
          counterName: name,
          data: aggregatedData,
          summary
        };
      } catch (err) {
        console.error(`Error querying counter "${name}":`, err);
        return {
          counterName: name,
          error: err.message,
          data: [],
          summary: null
        };
      }
    });

    // For single counter, return old format
    if (namesToQuery.length === 1) {
      res.json(countersData[0]);
    } else {
      res.json({
        counters: countersData,
        counterNames: namesToQuery
      });
    }
  } catch (error) {
    console.error('Error querying counters:', error);
    res.status(500).json({ error: error.message });
  }
});

// Query timers
app.post('/api/queries/timers', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { timerName, timerNames, startDate, endDate, groupBy } = req.body;

  // Support both single timer and multiple timers
  const namesToQuery = timerNames || (timerName ? [timerName] : []);

  // Validate inputs
  if (!namesToQuery || namesToQuery.length === 0) {
    return res.status(400).json({ error: 'At least one timer name is required' });
  }

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Start date and end date required' });
  }

  // Validate date range
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) {
    return res.status(400).json({ error: 'End date must be after start date' });
  }

  try {
    // Query all timers
    const timersData = namesToQuery.map(name => {
      try {
        const values = dataAccess.queryTimerValues(userId, name, startDate, endDate);

        if (values.length === 0) {
          return {
            timerName: name,
            data: [],
            summary: dataAccess.calculateTrackerSummary([])
          };
        }

        const aggregatedData = dataAccess.calculateTrackerAggregations(values, groupBy || 'day');
        const summary = dataAccess.calculateTrackerSummary(values);

        return {
          timerName: name,
          data: aggregatedData,
          summary
        };
      } catch (err) {
        console.error(`Error querying timer "${name}":`, err);
        return {
          timerName: name,
          error: err.message,
          data: [],
          summary: null
        };
      }
    });

    // For single timer, return old format
    if (namesToQuery.length === 1) {
      res.json(timersData[0]);
    } else {
      res.json({
        timers: timersData,
        timerNames: namesToQuery
      });
    }
  } catch (error) {
    console.error('Error querying timers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export query results to CSV
app.post('/api/exports/csv', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { type, queryParams } = req.body;

  if (!type || !queryParams) {
    return res.status(400).json({ error: 'Type and query parameters required' });
  }

  try {
    let csvContent;
    let filename;

    if (type === 'tasks') {
      // Query tasks
      const queryData = dataAccess.queryTasks(
        userId,
        queryParams.startDate,
        queryParams.endDate,
        queryParams.completionStatus || 'all',
        queryParams.groupBy || 'none'
      );

      // Generate CSV
      csvContent = generateTasksCSV(queryData);
      filename = `tasks_${queryParams.startDate}_to_${queryParams.endDate}.csv`;

    } else if (type === 'fields') {
      // Support both single field (fieldKey) and multiple fields (fieldKeys)
      const keysToExport = queryParams.fieldKeys || (queryParams.fieldKey ? [queryParams.fieldKey] : []);

      if (keysToExport.length === 0) {
        return res.status(400).json({ error: 'At least one field key required for export' });
      }

      const templates = dataAccess.getCustomFieldTemplates(userId);

      if (keysToExport.length === 1) {
        // Single field export (backward compatible)
        const fieldKey = keysToExport[0];
        const template = templates.find(t => t.key === fieldKey);
        const fieldType = template ? template.field_type : 'number';

        const values = dataAccess.queryFieldValues(
          userId,
          fieldKey,
          queryParams.startDate,
          queryParams.endDate
        );

        const queryData = {
          fieldKey,
          fieldType,
          data: values
        };

        csvContent = generateFieldsCSV(queryData, fieldKey);
        filename = `${fieldKey}_${queryParams.startDate}_to_${queryParams.endDate}.csv`;
      } else {
        // Multiple fields export - combined CSV
        const fieldsData = keysToExport.map(fieldKey => {
          const template = templates.find(t => t.key === fieldKey);
          const fieldType = template ? template.field_type : 'number';

          try {
            const values = dataAccess.queryFieldValues(
              userId,
              fieldKey,
              queryParams.startDate,
              queryParams.endDate
            );

            return {
              fieldKey,
              fieldType,
              values
            };
          } catch (err) {
            console.error(`Error querying field ${fieldKey}:`, err);
            return {
              fieldKey,
              fieldType,
              values: []
            };
          }
        });

        // Generate combined CSV
        csvContent = generateMultiFieldsCSV(fieldsData, queryParams.startDate, queryParams.endDate);
        filename = `fields_comparison_${queryParams.startDate}_to_${queryParams.endDate}.csv`;
      }

    } else {
      return res.status(400).json({ error: 'Invalid export type. Must be "tasks" or "fields"' });
    }

    // Send file
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Error generating CSV export:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// REORDERING ENDPOINTS
// ============================================================================

// Reorder custom field templates
app.post('/api/reorder/custom-field-templates', authMiddleware, (req, res) => {
  const { items } = req.body; // items is array of { id, order_index }
  try {
    dataAccess.reorderItems('custom_field_templates', items);
    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering custom field templates:', error);
    res.status(500).json({ error: 'Failed to reorder items' });
  }
});

// Reorder time since trackers
app.post('/api/reorder/time-since-trackers', authMiddleware, (req, res) => {
  const { items } = req.body;
  try {
    dataAccess.reorderItems('time_since_trackers', items);
    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering time since trackers:', error);
    res.status(500).json({ error: 'Failed to reorder items' });
  }
});

// Reorder duration trackers
app.post('/api/reorder/duration-trackers', authMiddleware, (req, res) => {
  const { items } = req.body;
  try {
    dataAccess.reorderItems('duration_trackers', items);
    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering duration trackers:', error);
    res.status(500).json({ error: 'Failed to reorder items' });
  }
});

// Reorder custom counters
app.post('/api/reorder/custom-counters', authMiddleware, (req, res) => {
  const { items } = req.body;
  try {
    dataAccess.reorderItems('custom_counters', items);
    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering custom counters:', error);
    res.status(500).json({ error: 'Failed to reorder items' });
  }
});

// Reorder daily custom fields
app.post('/api/reorder/daily-custom-fields', authMiddleware, (req, res) => {
  const { items } = req.body;
  try {
    dataAccess.reorderItems('daily_custom_fields', items);
    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering daily custom fields:', error);
    res.status(500).json({ error: 'Failed to reorder items' });
  }
});

// Reorder daily tasks
app.post('/api/reorder/daily-tasks', authMiddleware, (req, res) => {
  const { items } = req.body;
  try {
    dataAccess.reorderItems('daily_tasks', items);
    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering daily tasks:', error);
    res.status(500).json({ error: 'Failed to reorder items' });
  }
});

// Reorder activity entries
app.post('/api/reorder/activity-entries', authMiddleware, (req, res) => {
  const { items } = req.body;
  try {
    dataAccess.reorderItems('activity_entries', items);
    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering activity entries:', error);
    res.status(500).json({ error: 'Failed to reorder items' });
  }
});

// ============================================================================
// POINTS REDEMPTIONS
// ============================================================================

app.get('/api/points/balance', authMiddleware, (req, res) => {
  const userId = req.user.id;

  try {
    const earned = dataAccess.getTotalPointsEarned(userId);
    const redeemed = dataAccess.getTotalPointsRedeemed(userId);
    const balance = dataAccess.getPointsBalance(userId);

    res.json({ earned, redeemed, balance });
  } catch (error) {
    console.error('Error getting points balance:', error);
    res.status(500).json({ error: 'Failed to get points balance' });
  }
});

app.post('/api/points/redeem', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { rewardDescription, pointsCost } = req.body;

  if (!rewardDescription || !pointsCost || pointsCost <= 0) {
    return res.status(400).json({ error: 'Invalid redemption data' });
  }

  try {
    const balance = dataAccess.getPointsBalance(userId);

    if (balance < pointsCost) {
      return res.status(400).json({ error: 'Insufficient points' });
    }

    const redemptionId = dataAccess.createRedemption(userId, rewardDescription, pointsCost);
    const newBalance = dataAccess.getPointsBalance(userId);

    // Create a reward ticket task for today
    const today = getCurrentDateInUserTimezone(userId);
    const taskId = dataAccess.createDailyTask(
      userId,
      today,
      `🎁 ${rewardDescription}`,
      today,
      `Redeemed for ${pointsCost} points`,
      null,
      false,
      false,
      0,
      true, // isReward = true
      redemptionId // link to redemption
    );

    res.json({
      success: true,
      redemptionId,
      taskId,
      newBalance,
      message: `Redeemed "${rewardDescription}" for ${pointsCost} points!`
    });
  } catch (error) {
    console.error('Error redeeming points:', error);
    res.status(500).json({ error: 'Failed to redeem points' });
  }
});

app.get('/api/points/redemptions', authMiddleware, (req, res) => {
  const userId = req.user.id;

  try {
    const redemptions = dataAccess.getRedemptions(userId);
    res.json({ redemptions });
  } catch (error) {
    console.error('Error getting redemptions:', error);
    res.status(500).json({ error: 'Failed to get redemptions' });
  }
});

app.delete('/api/points/redemptions/:id', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const redemptionId = parseInt(req.params.id);

  if (!redemptionId || isNaN(redemptionId)) {
    return res.status(400).json({ error: 'Invalid redemption ID' });
  }

  try {
    const deleted = dataAccess.deleteRedemption(redemptionId, userId);

    if (!deleted) {
      return res.status(404).json({ error: 'Redemption not found' });
    }

    const newBalance = dataAccess.getPointsBalance(userId);

    res.json({
      success: true,
      newBalance,
      message: 'Redemption cancelled and points refunded'
    });
  } catch (error) {
    console.error('Error deleting redemption:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel redemption' });
  }
});

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.originalUrl
  });
});

// Global error handler - must be defined AFTER all routes
app.use((err, req, res, next) => {
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Don't leak error details in production
  const isDev = process.env.NODE_ENV !== 'production';

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(isDev && { stack: err.stack })
  });
});

// ============================================================================
// STATIC FILE SERVING (must be AFTER error handlers)
// ============================================================================

// Serve static files only in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));

  // Serve SPA
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Initialize default admin user before starting server
initializeDefaultAdmin();

app.listen(PORT, () => {
  console.log(`=== SERVER WORKING ===`);
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Database persistence enabled`);
  console.log(`=== LOGIN CREDENTIALS ===`);
  console.log(`Username: admin`);
  console.log(`Password: ${process.env.ADMIN_PASSWORD || 'admin123'}`);
  console.log(`=== TEST INSTRUCTIONS ===`);
  console.log(`1. Visit: http://localhost:${PORT}`);
  console.log(`2. Login with credentials above`);
  console.log(`3. Navigate to Profile page`);
  console.log(`4. Should see: User Management options`);
  console.log(`5. Should NOT see: "Admin Access Required" message`);
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
