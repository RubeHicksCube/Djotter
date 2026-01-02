const { db } = require('../database');
const dataAccess = require('../dataAccess');

// Sample data pools
const activities = [
  'Morning coffee and planning',
  'Team standup meeting',
  'Code review session',
  'Lunch break - had a great salad',
  'Worked on bug fixes',
  'Read documentation for new library',
  'Responded to emails',
  'Brainstorming session',
  'Fixed production issue',
  'Updated project roadmap',
  'Phone call with client',
  'Reviewed pull requests',
  'Refactored legacy code',
  'Wrote unit tests',
  'Deployed to staging',
  'Attended workshop',
  'Pair programming session',
  'Updated dependencies',
  'Coffee break with team',
  'End of day review'
];

const tasks = [
  'Review quarterly reports',
  'Update documentation',
  'Fix authentication bug',
  'Implement new feature',
  'Prepare presentation',
  'Schedule team meeting',
  'Clean up old branches',
  'Optimize database queries',
  'Write blog post',
  'Update project timeline',
  'Research new technologies',
  'Code review for PR #123',
  'Deploy hotfix to production',
  'Organize workspace',
  'Plan sprint tasks'
];

const fieldNames = ['Energy Level', 'Focus Score', 'Stress Level', 'Exercise Minutes', 'Water Intake'];
const counterNames = ['Coffee Cups', 'Meetings', 'Commits', 'Pages Read'];
const trackerNames = ['Deep Work Timer', 'Break Timer', 'Exercise Timer'];

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomTime(baseHour, variance = 2) {
  const hour = Math.max(0, Math.min(23, baseHour + Math.floor(Math.random() * variance * 2) - variance));
  const minute = Math.floor(Math.random() * 60);
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
}

function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function createTestSnapshots() {
  console.log('🌱 Seeding test snapshots...\n');

  // Get admin user (assuming ID 1)
  const userId = 1;
  const user = dataAccess.getUserById(userId);

  if (!user) {
    console.error('❌ User not found. Please ensure admin user exists.');
    return;
  }

  console.log(`📝 Creating snapshots for user: ${user.username}\n`);

  // Create custom field templates if they don't exist
  const existingTemplates = db.prepare('SELECT * FROM custom_field_templates WHERE user_id = ?').all(userId);
  if (existingTemplates.length === 0) {
    console.log('Creating custom field templates...');
    fieldNames.forEach((name, index) => {
      db.prepare('INSERT OR IGNORE INTO custom_field_templates (user_id, key, field_type, order_index) VALUES (?, ?, ?, ?)')
        .run(userId, name, 'number', index);
    });
  }

  // Create custom counters if they don't exist
  const existingCounters = db.prepare('SELECT * FROM custom_counters WHERE user_id = ?').all(userId);
  if (existingCounters.length === 0) {
    console.log('Creating custom counters...');
    counterNames.forEach((name, index) => {
      db.prepare('INSERT OR IGNORE INTO custom_counters (user_id, name, order_index) VALUES (?, ?, ?)')
        .run(userId, name, index);
    });
  }

  // Create duration trackers if they don't exist
  const existingTrackers = db.prepare('SELECT * FROM duration_trackers WHERE user_id = ?').all(userId);
  if (existingTrackers.length === 0) {
    console.log('Creating duration trackers...');
    trackerNames.forEach((name, index) => {
      db.prepare('INSERT INTO duration_trackers (user_id, name, type, is_running, elapsed_ms, order_index) VALUES (?, ?, ?, ?, ?, ?)')
        .run(userId, name, 'timer', 0, 0, index);
    });
  }

  const counterIds = db.prepare('SELECT id, name FROM custom_counters WHERE user_id = ?').all(userId);
  const trackerIds = db.prepare('SELECT id, name FROM duration_trackers WHERE user_id = ?').all(userId);

  // Generate 20 random dates in the last year
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const dates = [];

  for (let i = 0; i < 20; i++) {
    const randomDay = randomDate(oneYearAgo, now);
    const dateStr = randomDay.toISOString().split('T')[0];
    dates.push(dateStr);
  }

  // Sort dates chronologically
  dates.sort();

  console.log(`📅 Generating data for ${dates.length} dates...\n`);

  for (const date of dates) {
    console.log(`  📅 ${date}`);

    // Create daily state with sleep times
    const bedtime = randomTime(22, 2);
    const wakeTime = randomTime(7, 2);
    db.prepare('INSERT OR REPLACE INTO daily_state (user_id, date, previous_bedtime, wake_time) VALUES (?, ?, ?, ?)')
      .run(userId, date, bedtime, wakeTime);

    // Create custom field values
    fieldNames.forEach((fieldName, index) => {
      const value = randomInt(1, 10);
      db.prepare('INSERT OR REPLACE INTO daily_custom_fields (user_id, date, key, value, field_type, is_template, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(userId, date, fieldName, value.toString(), 'number', 1, index);
    });

    // Create tasks
    const numTasks = randomInt(3, 8);
    for (let i = 0; i < numTasks; i++) {
      const task = randomElement(tasks);
      const done = Math.random() > 0.4 ? 1 : 0;
      const createdAt = `${date} ${randomTime(9, 3)}`;
      const completedAt = done ? `${date} ${randomTime(14, 5)}` : null;

      db.prepare('INSERT INTO daily_tasks (user_id, date, text, done, created_at, completed_at, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(userId, date, task, done, createdAt, completedAt, i);
    }

    // Create activity log entries
    const numActivities = randomInt(5, 12);
    const baseTime = new Date(`${date}T09:00:00`);

    for (let i = 0; i < numActivities; i++) {
      const activity = randomElement(activities);
      const timestamp = new Date(baseTime.getTime() + i * 3600000 + randomInt(0, 1800000));
      const timestampStr = timestamp.toISOString().replace('T', ' ').substring(0, 19);

      db.prepare('INSERT INTO activity_entries (user_id, date, text, timestamp, order_index) VALUES (?, ?, ?, ?, ?)')
        .run(userId, date, activity, timestampStr, i);
    }

    // Create counter values
    counterIds.forEach(counter => {
      const value = randomInt(0, 15);
      db.prepare('INSERT OR REPLACE INTO custom_counter_values (counter_id, user_id, date, value) VALUES (?, ?, ?, ?)')
        .run(counter.id, userId, date, value);
    });

    // Update tracker elapsed times (simulate daily progress)
    trackerIds.forEach(tracker => {
      const elapsedMs = randomInt(600000, 7200000); // 10 min to 2 hours
      db.prepare('UPDATE duration_trackers SET elapsed_ms = ? WHERE id = ?')
        .run(elapsedMs, tracker.id);
    });

    // Build the state object for this date
    const templates = db.prepare('SELECT * FROM custom_field_templates WHERE user_id = ? ORDER BY order_index').all(userId);
    const dailyFieldsFromDB = db.prepare('SELECT * FROM daily_custom_fields WHERE user_id = ? AND date = ? ORDER BY order_index').all(userId, date);
    const tasksFromDB = db.prepare('SELECT * FROM daily_tasks WHERE user_id = ? AND date = ? ORDER BY order_index').all(userId, date);
    const entriesFromDB = db.prepare('SELECT * FROM activity_entries WHERE user_id = ? AND date = ? ORDER BY order_index').all(userId, date);
    const timeSinceTrackersDB = db.prepare('SELECT * FROM time_since_trackers WHERE user_id = ? ORDER BY order_index').all(userId);
    const durationTrackersDB = db.prepare('SELECT * FROM duration_trackers WHERE user_id = ? ORDER BY order_index').all(userId);

    const customFields = templates.map(template => {
      const valueField = dailyFieldsFromDB.find(f => f.key === template.key);
      return {
        id: template.id,
        key: template.key,
        value: valueField ? valueField.value : '',
        field_type: template.field_type || 'text'
      };
    });

    const dailyTasks = tasksFromDB.map(t => ({
      id: t.id,
      text: t.text,
      completed: t.done
    }));

    const entries = entriesFromDB.map(e => ({
      id: e.id,
      timestamp: e.timestamp,
      text: e.text,
      image: e.image
    }));

    const customCounters = counterIds.map(counter => {
      const valueRow = db.prepare('SELECT value FROM custom_counter_values WHERE counter_id = ? AND date = ?').get(counter.id, date);
      return {
        id: counter.id,
        name: counter.name,
        value: valueRow ? valueRow.value : 0
      };
    });

    const stateJson = {
      date: date,
      previousBedtime: bedtime,
      wakeTime: wakeTime,
      customFields: customFields,
      dailyCustomFields: [],
      dailyTasks: dailyTasks,
      customCounters: customCounters,
      entries: entries,
      timeSinceTrackers: timeSinceTrackersDB,
      durationTrackers: durationTrackersDB
    };

    // Create the snapshot
    try {
      dataAccess.saveSnapshot(userId, date, stateJson);
      console.log(`    ✅ Snapshot created with ${numTasks} tasks and ${numActivities} activities`);
    } catch (error) {
      console.error(`    ❌ Error creating snapshot: ${error.message}`);
    }
  }

  // Get final count
  const snapshotCount = db.prepare('SELECT COUNT(*) as count FROM snapshots WHERE user_id = ?').get(userId).count;

  console.log(`\n✅ Seeding complete!`);
  console.log(`📊 Total snapshots: ${snapshotCount}`);
  console.log(`📅 Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
}

// Run the seeder
createTestSnapshots()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
