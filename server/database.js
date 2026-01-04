const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'djotter.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Initialize database schema
function initializeDatabase() {
  // Users table (already exists from before)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // User settings (theme, timezone, auto-save)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER PRIMARY KEY,
      theme TEXT DEFAULT 'light',
      timezone TEXT DEFAULT 'UTC',
      auto_save INTEGER DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Profile fields (persistent custom fields shown in exports)
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, key)
    )
  `);

  // Custom field templates (persist name, value resets daily)
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_field_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, key)
    )
  `);

  // Time Since trackers (persist indefinitely)
  db.exec(`
    CREATE TABLE IF NOT EXISTS time_since_trackers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Duration trackers (timers that persist)
  db.exec(`
    CREATE TABLE IF NOT EXISTS duration_trackers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'timer',
      is_running INTEGER DEFAULT 0,
      start_time TEXT,
      elapsed_ms INTEGER DEFAULT 0,
      value INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Custom counters (persist name, value resets daily)
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_counters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, name)
    )
  `);

  // Daily state (bedtime, wake time, etc.)
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      previous_bedtime TEXT,
      wake_time TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, date)
    )
  `);

  // Daily custom field values (template-based, for current day)
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_custom_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      is_template INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, date, key)
    )
  `);

  // Daily tasks
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      text TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Activity entries (log entries throughout the day)
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Custom counter daily values
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_counter_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      counter_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      value INTEGER DEFAULT 0,
      FOREIGN KEY (counter_id) REFERENCES custom_counters(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(counter_id, date)
    )
  `);

  // Snapshot retention settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshot_settings (
      user_id INTEGER PRIMARY KEY,
      max_days INTEGER DEFAULT 30,
      max_count INTEGER DEFAULT 100,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Snapshots (saved daily states)
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      state_json TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, date)
    )
  `);

  // Points redemptions
  db.exec(`
    CREATE TABLE IF NOT EXISTS points_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      reward_description TEXT NOT NULL,
      points_cost INTEGER NOT NULL,
      redeemed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Add order_index columns for drag-and-drop sorting (migration)
  const addOrderIndexColumn = (tableName) => {
    try {
      const tableInfo = db.pragma(`table_info(${tableName})`);
      const hasOrderIndex = tableInfo.some(col => col.name === 'order_index');
      if (!hasOrderIndex) {
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN order_index INTEGER DEFAULT 0`);
        console.log(`✅ Added order_index column to ${tableName}`);
      }
    } catch (error) {
      console.error(`Error adding order_index to ${tableName}:`, error);
    }
  };

  // Add order_index to all sortable tables
  addOrderIndexColumn('custom_field_templates');
  addOrderIndexColumn('daily_custom_fields');
  addOrderIndexColumn('daily_tasks');
  addOrderIndexColumn('time_since_trackers');
  addOrderIndexColumn('duration_trackers');
  addOrderIndexColumn('custom_counters');
  addOrderIndexColumn('activity_entries');

  // Add field_type column for custom field templates (migration)
  const addFieldTypeColumns = () => {
    try {
      const templateInfo = db.pragma('table_info(custom_field_templates)');
      const hasFieldType = templateInfo.some(col => col.name === 'field_type');

      if (!hasFieldType) {
        db.exec(`ALTER TABLE custom_field_templates ADD COLUMN field_type TEXT DEFAULT 'text' CHECK(field_type IN ('text', 'number', 'currency', 'date', 'time', 'datetime', 'boolean'))`);
        console.log('✅ Added field_type column to custom_field_templates');
      } else {
        // Check if we need to update the constraint to include new field types
        // SQLite doesn't allow modifying CHECK constraints, so we need to rebuild the table
        try {
          // Try to insert a test currency field to see if constraint allows it
          const testId = db.prepare('INSERT INTO custom_field_templates (user_id, key, field_type, order_index) VALUES (?, ?, ?, ?)').run(-1, '__test__', 'currency', 0);
          db.prepare('DELETE FROM custom_field_templates WHERE id = ?').run(testId.lastInsertRowid);
        } catch (e) {
          // Constraint doesn't allow currency, need to rebuild table
          console.log('🔄 Updating custom_field_templates CHECK constraint...');

          // Rebuild table with updated constraint
          db.exec(`
            -- Create new table with updated constraint
            CREATE TABLE custom_field_templates_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              key TEXT NOT NULL,
              field_type TEXT DEFAULT 'text' CHECK(field_type IN ('text', 'number', 'currency', 'date', 'time', 'datetime', 'boolean')),
              order_index INTEGER DEFAULT 0,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
              UNIQUE(user_id, key)
            );

            -- Copy data from old table
            INSERT INTO custom_field_templates_new (id, user_id, key, field_type, order_index, created_at)
            SELECT id, user_id, key, COALESCE(field_type, 'text'), COALESCE(order_index, 0), created_at
            FROM custom_field_templates;

            -- Drop old table
            DROP TABLE custom_field_templates;

            -- Rename new table
            ALTER TABLE custom_field_templates_new RENAME TO custom_field_templates;
          `);

          console.log('✅ Updated custom_field_templates CHECK constraint');
        }
      }
    } catch (error) {
      console.error('Error adding field_type to custom_field_templates:', error);
    }

    try {
      const fieldInfo = db.pragma('table_info(daily_custom_fields)');
      const hasFieldType = fieldInfo.some(col => col.name === 'field_type');

      if (!hasFieldType) {
        db.exec(`ALTER TABLE daily_custom_fields ADD COLUMN field_type TEXT DEFAULT 'text'`);
        console.log('✅ Added field_type column to daily_custom_fields');
      }
    } catch (error) {
      console.error('Error adding field_type to daily_custom_fields:', error);
    }
  };

  // Create indexes for query performance (migration)
  const createQueryIndexes = () => {
    try {
      // Check if indexes exist
      const indexes = db.pragma('index_list(daily_tasks)');

      if (!indexes.some(idx => idx.name === 'idx_daily_tasks_user_date_done')) {
        db.exec('CREATE INDEX idx_daily_tasks_user_date_done ON daily_tasks(user_id, date, done)');
        console.log('✅ Created index idx_daily_tasks_user_date_done');
      }

      if (!indexes.some(idx => idx.name === 'idx_daily_tasks_completed_at')) {
        db.exec('CREATE INDEX idx_daily_tasks_completed_at ON daily_tasks(user_id, completed_at)');
        console.log('✅ Created index idx_daily_tasks_completed_at');
      }
    } catch (error) {
      console.error('Error creating task indexes:', error);
    }

    try {
      const fieldIndexes = db.pragma('index_list(daily_custom_fields)');

      if (!fieldIndexes.some(idx => idx.name === 'idx_daily_custom_fields_type')) {
        db.exec('CREATE INDEX idx_daily_custom_fields_type ON daily_custom_fields(user_id, key, field_type, date)');
        console.log('✅ Created index idx_daily_custom_fields_type');
      }
    } catch (error) {
      console.error('Error creating field indexes:', error);
    }

    // Add indexes for activity_entries
    try {
      const activityIndexes = db.pragma('index_list(activity_entries)');

      if (!activityIndexes.some(idx => idx.name === 'idx_activity_entries_user_date')) {
        db.exec('CREATE INDEX idx_activity_entries_user_date ON activity_entries(user_id, date)');
        console.log('✅ Created index idx_activity_entries_user_date');
      }
    } catch (error) {
      console.error('Error creating activity indexes:', error);
    }

    // Add indexes for custom_field_templates
    try {
      const templateIndexes = db.pragma('index_list(custom_field_templates)');

      if (!templateIndexes.some(idx => idx.name === 'idx_custom_field_templates_user')) {
        db.exec('CREATE INDEX idx_custom_field_templates_user ON custom_field_templates(user_id, order_index)');
        console.log('✅ Created index idx_custom_field_templates_user');
      }
    } catch (error) {
      console.error('Error creating template indexes:', error);
    }

    // Add indexes for time_since_trackers
    try {
      const timeSinceIndexes = db.pragma('index_list(time_since_trackers)');

      if (!timeSinceIndexes.some(idx => idx.name === 'idx_time_since_trackers_user')) {
        db.exec('CREATE INDEX idx_time_since_trackers_user ON time_since_trackers(user_id)');
        console.log('✅ Created index idx_time_since_trackers_user');
      }
    } catch (error) {
      console.error('Error creating time_since indexes:', error);
    }

    // Add indexes for duration_trackers
    try {
      const durationIndexes = db.pragma('index_list(duration_trackers)');

      if (!durationIndexes.some(idx => idx.name === 'idx_duration_trackers_user')) {
        db.exec('CREATE INDEX idx_duration_trackers_user ON duration_trackers(user_id)');
        console.log('✅ Created index idx_duration_trackers_user');
      }
    } catch (error) {
      console.error('Error creating duration indexes:', error);
    }
  };

  // Add enhanced task columns (migration)
  const addEnhancedTaskColumns = () => {
    try {
      const taskInfo = db.pragma('table_info(daily_tasks)');
      const hasDueDate = taskInfo.some(col => col.name === 'due_date');
      const hasDetails = taskInfo.some(col => col.name === 'details');
      const hasParentTaskId = taskInfo.some(col => col.name === 'parent_task_id');
      const hasLogEntryId = taskInfo.some(col => col.name === 'log_entry_id');
      const hasPinned = taskInfo.some(col => col.name === 'pinned');
      const hasRecurring = taskInfo.some(col => col.name === 'recurring');

      if (!hasDueDate) {
        db.exec('ALTER TABLE daily_tasks ADD COLUMN due_date TEXT');
        console.log('✅ Added due_date column to daily_tasks');
      }

      if (!hasDetails) {
        db.exec('ALTER TABLE daily_tasks ADD COLUMN details TEXT');
        console.log('✅ Added details column to daily_tasks');
      }

      if (!hasParentTaskId) {
        db.exec('ALTER TABLE daily_tasks ADD COLUMN parent_task_id INTEGER REFERENCES daily_tasks(id) ON DELETE CASCADE');
        console.log('✅ Added parent_task_id column to daily_tasks');
      }

      if (!hasLogEntryId) {
        db.exec('ALTER TABLE daily_tasks ADD COLUMN log_entry_id INTEGER REFERENCES activity_entries(id) ON DELETE SET NULL');
        console.log('✅ Added log_entry_id column to daily_tasks');
      }

      if (!hasPinned) {
        db.exec('ALTER TABLE daily_tasks ADD COLUMN pinned INTEGER DEFAULT 0');
        console.log('✅ Added pinned column to daily_tasks');
      }

      if (!hasRecurring) {
        db.exec('ALTER TABLE daily_tasks ADD COLUMN recurring INTEGER DEFAULT 0');
        console.log('✅ Added recurring column to daily_tasks');
      }
    } catch (error) {
      console.error('Error adding enhanced task columns:', error);
    }
  };

  // Add timestamp columns for task tracking (migration)
  const addTimestampColumns = () => {
    try {
      const taskInfo = db.pragma('table_info(daily_tasks)');
      const hasCompletedAt = taskInfo.some(col => col.name === 'completed_at');
      const hasUpdatedAt = taskInfo.some(col => col.name === 'updated_at');

      if (!hasCompletedAt) {
        db.exec('ALTER TABLE daily_tasks ADD COLUMN completed_at TEXT');
        console.log('✅ Added completed_at column to daily_tasks');

        // Backfill completed_at for existing completed tasks
        db.exec(`UPDATE daily_tasks SET completed_at = created_at WHERE done = 1 AND completed_at IS NULL`);
        console.log('✅ Backfilled completed_at for existing completed tasks');
      }

      if (!hasUpdatedAt) {
        db.exec('ALTER TABLE daily_tasks ADD COLUMN updated_at TEXT');
        // Backfill with current timestamp for existing rows
        db.exec(`UPDATE daily_tasks SET updated_at = created_at WHERE updated_at IS NULL`);
        console.log('✅ Added updated_at column to daily_tasks');
      }
    } catch (error) {
      console.error('Error adding timestamp columns:', error);
    }
  };

  // Add image column to activity_entries (migration)
  const addActivityEntryImageColumn = () => {
    try {
      const entryInfo = db.pragma('table_info(activity_entries)');
      const hasImage = entryInfo.some(col => col.name === 'image');

      if (!hasImage) {
        db.exec('ALTER TABLE activity_entries ADD COLUMN image TEXT');
        console.log('✅ Added image column to activity_entries');
      }
    } catch (error) {
      console.error('Error adding image column to activity_entries:', error);
    }
  };

  // Add is_locked column to duration_trackers (migration)
  const addDurationTrackerLockColumn = () => {
    try {
      const trackerInfo = db.pragma('table_info(duration_trackers)');
      const hasIsLocked = trackerInfo.some(col => col.name === 'is_locked');

      if (!hasIsLocked) {
        db.exec('ALTER TABLE duration_trackers ADD COLUMN is_locked INTEGER DEFAULT 0');
        console.log('✅ Added is_locked column to duration_trackers');
      }
    } catch (error) {
      console.error('Error adding is_locked column to duration_trackers:', error);
    }
  };

  // Add points column to daily_tasks (migration)
  const addTaskPointsColumn = () => {
    try {
      const taskInfo = db.pragma('table_info(daily_tasks)');
      const hasPoints = taskInfo.some(col => col.name === 'points');

      if (!hasPoints) {
        db.exec('ALTER TABLE daily_tasks ADD COLUMN points INTEGER DEFAULT 0');
        console.log('✅ Added points column to daily_tasks');
      }
    } catch (error) {
      console.error('Error adding points column to daily_tasks:', error);
    }
  };

  // Fix user_settings table schema (migration)
  const fixUserSettingsSchema = () => {
    try {
      const userSettingsInfo = db.pragma('table_info(user_settings)');
      const hasTheme = userSettingsInfo.some(col => col.name === 'theme');
      const hasTimezone = userSettingsInfo.some(col => col.name === 'timezone');
      const hasAutoSave = userSettingsInfo.some(col => col.name === 'auto_save');

      // Add missing columns if they don't exist
      if (!hasTheme) {
        db.exec("ALTER TABLE user_settings ADD COLUMN theme TEXT DEFAULT 'light'");
        console.log('✅ Added theme column to user_settings');
      }

      if (!hasTimezone) {
        db.exec("ALTER TABLE user_settings ADD COLUMN timezone TEXT DEFAULT 'UTC'");
        console.log('✅ Added timezone column to user_settings');
      }

      if (!hasAutoSave) {
        db.exec('ALTER TABLE user_settings ADD COLUMN auto_save INTEGER DEFAULT 1');
        console.log('✅ Added auto_save column to user_settings');
      }
    } catch (error) {
      console.error('Error fixing user_settings schema:', error);
    }
  };

  // Run migrations
  fixUserSettingsSchema();
  addTimestampColumns();
  addFieldTypeColumns();
  createQueryIndexes();
  addEnhancedTaskColumns();
  addActivityEntryImageColumn();
  addDurationTrackerLockColumn();
  addTaskPointsColumn();

  // Fix any users with invalid created_at timestamps
  const usersWithInvalidDates = db.prepare(`
    SELECT id, username, created_at FROM users
    WHERE created_at IS NULL OR created_at = ''
  `).all();

  if (usersWithInvalidDates.length > 0) {
    console.log(`🔄 Fixing ${usersWithInvalidDates.length} users with invalid timestamps...`);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const updateStmt = db.prepare('UPDATE users SET created_at = ? WHERE id = ?');

    usersWithInvalidDates.forEach(user => {
      updateStmt.run(now, user.id);
      console.log(`  ✅ Fixed timestamp for user: ${user.username}`);
    });
  }

  // Fix any activity entries with invalid timestamps
  const entriesWithInvalidDates = db.prepare(`
    SELECT id, user_id, timestamp FROM activity_entries
    WHERE timestamp IS NULL OR timestamp = ''
  `).all();

  if (entriesWithInvalidDates.length > 0) {
    console.log(`🔄 Fixing ${entriesWithInvalidDates.length} activity entries with invalid timestamps...`);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const updateStmt = db.prepare('UPDATE activity_entries SET timestamp = ? WHERE id = ?');

    entriesWithInvalidDates.forEach(entry => {
      updateStmt.run(now, entry.id);
      console.log(`  ✅ Fixed timestamp for entry ID: ${entry.id}`);
    });
  }

  console.log('✅ Database initialized successfully');
}

// Initialize on module load
initializeDatabase();

module.exports = { db, initializeDatabase };
