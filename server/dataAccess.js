const { db } = require('./database');

// ============================================================================
// USER MANAGEMENT
// ============================================================================

function getAllUsers() {
  return db.prepare('SELECT id, username, email, is_admin, created_at FROM users').all();
}

function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username);
}

function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
}

function getUserSettings(userId) {
  let settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);

  // If no settings exist, create default settings
  if (!settings) {
    db.prepare('INSERT INTO user_settings (user_id, theme, timezone, auto_save) VALUES (?, ?, ?, ?)').run(userId, 'light', 'UTC', 1);
    settings = { user_id: userId, theme: 'light', timezone: 'UTC', auto_save: 1 };
  }

  return {
    theme: settings.theme,
    timezone: settings.timezone,
    autoSave: Boolean(settings.auto_save)
  };
}

function updateUserSettings(userId, settings) {
  const updates = [];
  const values = [];

  if (settings.theme !== undefined) {
    updates.push('theme = ?');
    values.push(settings.theme);
  }
  if (settings.timezone !== undefined) {
    updates.push('timezone = ?');
    values.push(settings.timezone);
  }
  if (settings.autoSave !== undefined) {
    updates.push('auto_save = ?');
    values.push(settings.autoSave ? 1 : 0);
  }

  if (updates.length > 0) {
    values.push(userId);
    db.prepare(`UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = ?`).run(...values);
  }
}

function createUser(username, email, passwordHash, isAdmin = false) {
  const result = db.prepare(
    'INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)'
  ).run(username, email, passwordHash, isAdmin ? 1 : 0);
  return result.lastInsertRowid;
}

function updateUser(id, updates) {
  const fields = [];
  const values = [];

  if (updates.username !== undefined) {
    fields.push('username = ?');
    values.push(updates.username);
  }
  if (updates.email !== undefined) {
    fields.push('email = ?');
    values.push(updates.email);
  }
  if (updates.password_hash !== undefined) {
    fields.push('password_hash = ?');
    values.push(updates.password_hash);
  }

  if (fields.length === 0) return;

  values.push(id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

function deleteUser(id) {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

// ============================================================================
// PROFILE FIELDS
// ============================================================================

function getProfileFields(userId) {
  const rows = db.prepare('SELECT key, value FROM profile_fields WHERE user_id = ?').all(userId);
  const fields = {};
  rows.forEach(row => {
    fields[row.key] = row.value;
  });
  return fields;
}

function setProfileField(userId, key, value) {
  db.prepare(`
    INSERT INTO profile_fields (user_id, key, value)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value
  `).run(userId, key, value);
}

function deleteProfileField(userId, key) {
  db.prepare('DELETE FROM profile_fields WHERE user_id = ? AND key = ?').run(userId, key);
}

// ============================================================================
// CUSTOM FIELD TEMPLATES
// ============================================================================

function getCustomFieldTemplates(userId) {
  return db.prepare('SELECT id, key, field_type, order_index FROM custom_field_templates WHERE user_id = ? ORDER BY order_index').all(userId);
}

function getCustomFieldTemplate(userId, key) {
  return db.prepare('SELECT id, key, field_type FROM custom_field_templates WHERE user_id = ? AND key = ?').get(userId, key);
}

function createCustomFieldTemplate(userId, key, fieldType = 'text') {
  // Validate field type
  if (!['text', 'number', 'currency', 'date', 'time', 'datetime', 'boolean'].includes(fieldType)) {
    throw new Error('Invalid field type. Must be "text", "number", "currency", "date", "time", "datetime", or "boolean"');
  }

  const maxOrder = db.prepare('SELECT COALESCE(MAX(order_index), -1) as max FROM custom_field_templates WHERE user_id = ?').get(userId);
  const result = db.prepare(
    'INSERT INTO custom_field_templates (user_id, key, field_type, order_index) VALUES (?, ?, ?, ?)'
  ).run(userId, key, fieldType, maxOrder.max + 1);
  return result.lastInsertRowid;
}

function updateCustomFieldTemplate(id, updates) {
  const fields = [];
  const values = [];

  if (updates.fieldType !== undefined) {
    fields.push('field_type = ?');
    values.push(updates.fieldType);
  }

  if (fields.length === 0) return;

  values.push(id);
  db.prepare(`UPDATE custom_field_templates SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

function deleteCustomFieldTemplate(userId, key) {
  db.prepare('DELETE FROM custom_field_templates WHERE user_id = ? AND key = ?').run(userId, key);
}

// ============================================================================
// TIME SINCE TRACKERS
// ============================================================================

function getTimeSinceTrackers(userId) {
  return db.prepare('SELECT id, name, date, order_index FROM time_since_trackers WHERE user_id = ? ORDER BY order_index').all(userId);
}

function createTimeSinceTracker(userId, name, date) {
  const maxOrder = db.prepare('SELECT COALESCE(MAX(order_index), -1) as max FROM time_since_trackers WHERE user_id = ?').get(userId);
  const result = db.prepare(
    'INSERT INTO time_since_trackers (user_id, name, date, order_index) VALUES (?, ?, ?, ?)'
  ).run(userId, name, date, maxOrder.max + 1);
  return result.lastInsertRowid;
}

function deleteTimeSinceTracker(id) {
  db.prepare('DELETE FROM time_since_trackers WHERE id = ?').run(id);
}

// ============================================================================
// DURATION TRACKERS
// ============================================================================

function getDurationTrackers(userId) {
  return db.prepare(`
    SELECT id, name, type, is_running, is_locked, start_time, elapsed_ms, value, order_index
    FROM duration_trackers WHERE user_id = ? ORDER BY order_index
  `).all(userId).map(row => ({
    ...row,
    isRunning: Boolean(row.is_running),
    isLocked: Boolean(row.is_locked),
    startTime: row.start_time,
    elapsedMs: row.elapsed_ms
  }));
}

function createDurationTracker(userId, name) {
  const maxOrder = db.prepare('SELECT COALESCE(MAX(order_index), -1) as max FROM duration_trackers WHERE user_id = ?').get(userId);
  const result = db.prepare(
    'INSERT INTO duration_trackers (user_id, name, type, order_index) VALUES (?, ?, ?, ?)'
  ).run(userId, name, 'timer', maxOrder.max + 1);
  return result.lastInsertRowid;
}

function updateDurationTracker(id, updates) {
  const fields = [];
  const values = [];

  if (updates.isRunning !== undefined) {
    fields.push('is_running = ?');
    values.push(updates.isRunning ? 1 : 0);
  }
  if (updates.isLocked !== undefined) {
    fields.push('is_locked = ?');
    values.push(updates.isLocked ? 1 : 0);
  }
  if (updates.startTime !== undefined) {
    fields.push('start_time = ?');
    values.push(updates.startTime);
  }
  if (updates.elapsedMs !== undefined) {
    fields.push('elapsed_ms = ?');
    values.push(updates.elapsedMs);
  }
  if (updates.value !== undefined) {
    fields.push('value = ?');
    values.push(updates.value);
  }

  if (fields.length === 0) return;

  values.push(id);
  db.prepare(`UPDATE duration_trackers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

function deleteDurationTracker(id) {
  db.prepare('DELETE FROM duration_trackers WHERE id = ?').run(id);
}

// ============================================================================
// CUSTOM COUNTERS
// ============================================================================

function getCustomCounters(userId) {
  return db.prepare('SELECT id, name, order_index FROM custom_counters WHERE user_id = ? ORDER BY order_index').all(userId);
}

function createCustomCounter(userId, name) {
  const maxOrder = db.prepare('SELECT COALESCE(MAX(order_index), -1) as max FROM custom_counters WHERE user_id = ?').get(userId);
  const result = db.prepare(
    'INSERT INTO custom_counters (user_id, name, order_index) VALUES (?, ?, ?)'
  ).run(userId, name, maxOrder.max + 1);
  return result.lastInsertRowid;
}

function deleteCustomCounter(id) {
  db.prepare('DELETE FROM custom_counters WHERE id = ?').run(id);
}

function getCustomCounterValue(counterId, date) {
  const row = db.prepare(
    'SELECT value FROM custom_counter_values WHERE counter_id = ? AND date = ?'
  ).get(counterId, date);
  return row ? row.value : 0;
}

function setCustomCounterValue(counterId, userId, date, value) {
  db.prepare(`
    INSERT INTO custom_counter_values (counter_id, user_id, date, value)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(counter_id, date) DO UPDATE SET value = excluded.value
  `).run(counterId, userId, date, value);
}

// ============================================================================
// DAILY STATE
// ============================================================================

function getDailyState(userId, date) {
  return db.prepare(
    'SELECT previous_bedtime, wake_time FROM daily_state WHERE user_id = ? AND date = ?'
  ).get(userId, date);
}

function setDailyState(userId, date, previousBedtime, wakeTime) {
  db.prepare(`
    INSERT INTO daily_state (user_id, date, previous_bedtime, wake_time, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, date) DO UPDATE SET
      previous_bedtime = excluded.previous_bedtime,
      wake_time = excluded.wake_time,
      updated_at = CURRENT_TIMESTAMP
  `).run(userId, date, previousBedtime, wakeTime);
}

// ============================================================================
// DAILY CUSTOM FIELDS
// ============================================================================

function getDailyCustomFields(userId, date) {
  return db.prepare(
    'SELECT id, key, value, is_template, order_index FROM daily_custom_fields WHERE user_id = ? AND date = ? ORDER BY order_index'
  ).all(userId, date).map(row => ({
    id: row.id,
    key: row.key,
    value: row.value,
    isTemplate: Boolean(row.is_template)
  }));
}

function setDailyCustomField(userId, date, key, value, isTemplate = true, fieldType = null) {
  // If fieldType not provided, get from template
  if (!fieldType && isTemplate) {
    const template = db.prepare('SELECT field_type FROM custom_field_templates WHERE user_id = ? AND key = ?').get(userId, key);
    fieldType = template ? template.field_type : 'text';
  } else if (!fieldType) {
    fieldType = 'text';
  }

  // Validate numeric values
  if (fieldType === 'number' && value && value.trim() !== '' && isNaN(parseFloat(value))) {
    throw new Error(`Invalid numeric value for field ${key}: ${value}`);
  }

  // Convert boolean values to string
  if (fieldType === 'boolean') {
    value = value ? 'true' : 'false';
  }

  const maxOrder = db.prepare('SELECT COALESCE(MAX(order_index), -1) as max FROM daily_custom_fields WHERE user_id = ? AND date = ?').get(userId, date);
  db.prepare(`
    INSERT INTO daily_custom_fields (user_id, date, key, value, is_template, field_type, order_index)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, date, key) DO UPDATE SET value = excluded.value, field_type = excluded.field_type
  `).run(userId, date, key, value, isTemplate ? 1 : 0, fieldType, maxOrder.max + 1);
}

function deleteDailyCustomField(userId, date, key) {
  db.prepare('DELETE FROM daily_custom_fields WHERE user_id = ? AND date = ? AND key = ?')
    .run(userId, date, key);
}

function deleteDailyCustomFieldById(id) {
  db.prepare('DELETE FROM daily_custom_fields WHERE id = ?').run(id);
}

// ============================================================================
// DAILY TASKS
// ============================================================================

function getDailyTasks(userId, date) {
  // Get all tasks (parent tasks only if no date filter, or all for specific date)
  const query = date
    ? 'SELECT * FROM daily_tasks WHERE user_id = ? AND (date = ? OR due_date = ?) AND parent_task_id IS NULL ORDER BY order_index'
    : 'SELECT * FROM daily_tasks WHERE user_id = ? AND parent_task_id IS NULL ORDER BY due_date, order_index';

  const params = date ? [userId, date, date] : [userId];
  const tasks = db.prepare(query).all(...params);

  return tasks.map(row => {
    // Get sub-tasks for this task
    const subTasks = db.prepare(
      'SELECT * FROM daily_tasks WHERE parent_task_id = ? ORDER BY order_index'
    ).all(row.id).map(subRow => ({
      id: subRow.id,
      text: subRow.text,
      done: Boolean(subRow.done),
      dueDate: subRow.due_date,
      details: subRow.details,
      points: subRow.points || 0,
      isReward: Boolean(subRow.is_reward),
      pinned: Boolean(subRow.pinned),
      recurring: Boolean(subRow.recurring),
      completedAt: subRow.completed_at,
      createdAt: subRow.created_at,
      orderIndex: subRow.order_index
    }));

    return {
      id: row.id,
      text: row.text,
      done: Boolean(row.done),
      dueDate: row.due_date,
      details: row.details,
      points: row.points || 0,
      isReward: Boolean(row.is_reward),
      logEntryId: row.log_entry_id,
      pinned: Boolean(row.pinned),
      recurring: Boolean(row.recurring),
      subTasks: subTasks,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      orderIndex: row.order_index
    };
  });
}

function createDailyTask(userId, date, text, dueDate = null, details = null, parentTaskId = null, pinned = false, recurring = false, points = 0, isReward = false, redemptionId = null) {
  const maxOrder = parentTaskId
    ? db.prepare('SELECT COALESCE(MAX(order_index), -1) as max FROM daily_tasks WHERE parent_task_id = ?').get(parentTaskId)
    : db.prepare('SELECT COALESCE(MAX(order_index), -1) as max FROM daily_tasks WHERE user_id = ? AND date = ? AND parent_task_id IS NULL').get(userId, date);

  const result = db.prepare(
    'INSERT INTO daily_tasks (user_id, date, text, due_date, details, parent_task_id, pinned, recurring, points, is_reward, redemption_id, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, date, text, dueDate || date, details, parentTaskId, pinned ? 1 : 0, recurring ? 1 : 0, points || 0, isReward ? 1 : 0, redemptionId, maxOrder.max + 1);
  return result.lastInsertRowid;
}

function updateDailyTask(id, updates) {
  const fields = [];
  const values = [];

  if (updates.text !== undefined) {
    fields.push('text = ?');
    values.push(updates.text);
  }
  if (updates.dueDate !== undefined) {
    fields.push('due_date = ?');
    values.push(updates.dueDate);
  }
  if (updates.details !== undefined) {
    fields.push('details = ?');
    values.push(updates.details);
  }
  if (updates.logEntryId !== undefined) {
    fields.push('log_entry_id = ?');
    values.push(updates.logEntryId);
  }
  if (updates.pinned !== undefined) {
    fields.push('pinned = ?');
    values.push(updates.pinned ? 1 : 0);
  }
  if (updates.recurring !== undefined) {
    fields.push('recurring = ?');
    values.push(updates.recurring ? 1 : 0);
  }
  if (updates.points !== undefined) {
    fields.push('points = ?');
    values.push(updates.points || 0);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  db.prepare(`UPDATE daily_tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

function toggleDailyTask(id) {
  // Get current state including all necessary fields
  const task = db.prepare('SELECT id, user_id, date, text, done, due_date, details, completed_at, is_reward FROM daily_tasks WHERE id = ?').get(id);
  if (!task) return null;

  // Toggle done state
  const newDone = task.done ? 0 : 1;
  // Set completed_at when marking complete, clear when marking incomplete
  const completedAt = newDone ? new Date().toISOString() : null;

  db.prepare(`
    UPDATE daily_tasks
    SET done = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(newDone, completedAt, id);

  // Return task data with updated completion status
  return {
    ...task,
    done: newDone,
    completedAt: completedAt
  };
}

function deleteDailyTask(id) {
  db.prepare('DELETE FROM daily_tasks WHERE id = ?').run(id);
}

// ============================================================================
// ACTIVITY ENTRIES
// ============================================================================

function getActivityEntries(userId, date) {
  return db.prepare('SELECT id, text, image, timestamp, order_index FROM activity_entries WHERE user_id = ? AND date = ? ORDER BY order_index')
    .all(userId, date);
}

function createActivityEntry(userId, date, text, image = null) {
  const maxOrder = db.prepare('SELECT COALESCE(MAX(order_index), -1) as max FROM activity_entries WHERE user_id = ? AND date = ?').get(userId, date);
  const result = db.prepare(
    'INSERT INTO activity_entries (user_id, date, text, image, order_index) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, date, text, image, maxOrder.max + 1);
  return result.lastInsertRowid;
}

function updateActivityEntry(id, text) {
  db.prepare('UPDATE activity_entries SET text = ? WHERE id = ?').run(text, id);
}

function deleteActivityEntry(id) {
  db.prepare('DELETE FROM activity_entries WHERE id = ?').run(id);
}

// ============================================================================
// SNAPSHOT SETTINGS
// ============================================================================

function getSnapshotSettings(userId) {
  const row = db.prepare('SELECT max_days, max_count FROM snapshot_settings WHERE user_id = ?').get(userId);
  return row || { max_days: 30, max_count: 100 };
}

function setSnapshotSettings(userId, maxDays, maxCount) {
  db.prepare(`
    INSERT INTO snapshot_settings (user_id, max_days, max_count)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET max_days = excluded.max_days, max_count = excluded.max_count
  `).run(userId, maxDays, maxCount);
}

// ============================================================================
// SNAPSHOTS
// ============================================================================

function getSnapshots(userId) {
  return db.prepare('SELECT date, created_at FROM snapshots WHERE user_id = ? ORDER BY date DESC')
    .all(userId);
}

function getSnapshot(userId, date) {
  const row = db.prepare('SELECT state_json FROM snapshots WHERE user_id = ? AND date = ?')
    .get(userId, date);
  return row ? JSON.parse(row.state_json) : null;
}

function saveSnapshot(userId, date, stateJson) {
  db.prepare(`
    INSERT INTO snapshots (user_id, date, state_json)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET state_json = excluded.state_json, created_at = CURRENT_TIMESTAMP
  `).run(userId, date, JSON.stringify(stateJson));
}

function deleteSnapshot(userId, date) {
  db.prepare('DELETE FROM snapshots WHERE user_id = ? AND date = ?').run(userId, date);
}

// ============================================================================
// REORDERING
// ============================================================================

function reorderItems(tableName, items) {
  const stmt = db.prepare(`UPDATE ${tableName} SET order_index = ? WHERE id = ?`);
  const transaction = db.transaction((itemsToUpdate) => {
    itemsToUpdate.forEach((item, index) => {
      stmt.run(index, item.id);
    });
  });
  transaction(items);
}

// ============================================================================
// QUERY FUNCTIONS FOR ANALYTICS
// ============================================================================

const { startOfWeek, startOfMonth, startOfYear, format: formatDate } = require('date-fns');

// Helper: Group tasks by period
function groupTasksByPeriod(tasks, groupBy) {
  if (groupBy === 'none') {
    return tasks;
  }

  const groups = {};

  tasks.forEach(task => {
    let groupKey;
    const taskDate = new Date(task.date);

    if (groupBy === 'year') {
      const yearStart = startOfYear(taskDate);
      groupKey = formatDate(yearStart, 'yyyy-MM-dd');
    } else if (groupBy === 'week') {
      const weekStart = startOfWeek(taskDate, { weekStartsOn: 1 }); // Monday
      groupKey = formatDate(weekStart, 'yyyy-MM-dd');
    } else if (groupBy === 'month') {
      const monthStart = startOfMonth(taskDate);
      groupKey = formatDate(monthStart, 'yyyy-MM-dd');
    } else {
      groupKey = task.date;
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(task);
  });

  return Object.entries(groups).map(([date, tasks]) => ({
    date,
    tasks
  }));
}

// Helper: Calculate task statistics
function calculateTaskStats(tasks) {
  const total = tasks.length;
  const completed = tasks.filter(t => t.done).length;
  const incomplete = total - completed;
  const completionRate = total > 0 ? completed / total : 0;

  // Calculate average time to complete (in minutes)
  const completedWithTimes = tasks.filter(t => t.done && t.completed_at && t.created_at);
  let avgTimeToComplete = null;

  if (completedWithTimes.length > 0) {
    const totalTime = completedWithTimes.reduce((sum, task) => {
      const created = new Date(task.created_at).getTime();
      const completed = new Date(task.completed_at).getTime();
      return sum + (completed - created);
    }, 0);
    avgTimeToComplete = Math.round(totalTime / completedWithTimes.length / 1000 / 60); // Convert to minutes
  }

  return {
    total,
    completed,
    incomplete,
    completion_rate: completionRate,
    avg_time_to_complete_minutes: avgTimeToComplete
  };
}

// Query tasks with filters
function queryTasks(userId, startDate, endDate, completionStatus, groupBy) {
  // Build WHERE clause
  let where = 'user_id = ? AND date >= ? AND date <= ?';
  const params = [userId, startDate, endDate];

  if (completionStatus === 'completed') {
    where += ' AND done = 1';
  } else if (completionStatus === 'incomplete') {
    where += ' AND done = 0';
  }

  // Query tasks
  const tasks = db.prepare(`
    SELECT id, date, text, done, created_at, completed_at, updated_at
    FROM daily_tasks
    WHERE ${where}
    ORDER BY date, order_index
  `).all(...params);

  // Group if requested
  if (groupBy && groupBy !== 'none') {
    const grouped = groupTasksByPeriod(tasks, groupBy);
    const data = grouped.map(group => ({
      date: group.date,
      tasks: group.tasks,
      stats: calculateTaskStats(group.tasks)
    }));

    return {
      data,
      summary: calculateTaskStats(tasks)
    };
  }

  return {
    data: [{
      date: startDate,
      tasks,
      stats: calculateTaskStats(tasks)
    }],
    summary: calculateTaskStats(tasks)
  };
}

// Get all populated fields in a date range
function getPopulatedFieldsInRange(userId, startDate, endDate) {
  const fields = db.prepare(`
    SELECT DISTINCT dcf.key, cft.field_type
    FROM daily_custom_fields dcf
    LEFT JOIN custom_field_templates cft ON dcf.user_id = cft.user_id AND dcf.key = cft.key
    WHERE dcf.user_id = ? AND dcf.date >= ? AND dcf.date <= ?
    AND dcf.value IS NOT NULL AND dcf.value != ''
    ORDER BY dcf.key
  `).all(userId, startDate, endDate);

  return fields.map(f => ({
    key: f.key,
    fieldType: f.field_type || 'text'
  }));
}

// Query field values for analytics
function queryFieldValues(userId, fieldKey, startDate, endDate) {
  // Get field type from template
  const template = db.prepare(`
    SELECT field_type FROM custom_field_templates
    WHERE user_id = ? AND key = ?
  `).get(userId, fieldKey);

  if (!template) {
    throw new Error('Field template not found');
  }

  const fieldType = template.field_type;

  // Query field values based on type
  const values = db.prepare(`
    SELECT date, value, created_at, field_type
    FROM daily_custom_fields
    WHERE user_id = ? AND key = ? AND date >= ? AND date <= ?
    ORDER BY date
  `).all(userId, fieldKey, startDate, endDate);

  // Filter and transform based on field type
  if (fieldType === 'number' || fieldType === 'currency') {
    return values
      .filter(v => v.value && v.value.trim() !== '')
      .map(v => ({
        date: v.date,
        value: parseFloat(v.value),
        created_at: v.created_at,
        fieldType: v.field_type
      }));
  } else if (fieldType === 'boolean') {
    return values
      .filter(v => v.value && v.value.trim() !== '')
      .map(v => ({
        date: v.date,
        value: v.value === 'true' || v.value === '1',
        created_at: v.created_at,
        fieldType: v.field_type
      }));
  } else {
    // For text, date, time, datetime - just return raw values
    return values
      .filter(v => v.value && v.value.trim() !== '')
      .map(v => ({
        date: v.date,
        value: v.value,
        created_at: v.created_at,
        fieldType: v.field_type
      }));
  }
}

// Helper: Group field values by period
function groupFieldValuesByPeriod(values, groupBy) {
  if (!groupBy || groupBy === 'day') {
    return values.map(v => ({
      date: v.date,
      values: [v.value],
      value: v.value
    }));
  }

  const groups = {};

  values.forEach(item => {
    let groupKey;
    const itemDate = new Date(item.date);

    if (groupBy === 'year') {
      const yearStart = startOfYear(itemDate);
      groupKey = formatDate(yearStart, 'yyyy-MM-dd');
    } else if (groupBy === 'week') {
      const weekStart = startOfWeek(itemDate, { weekStartsOn: 1 });
      groupKey = formatDate(weekStart, 'yyyy-MM-dd');
    } else if (groupBy === 'month') {
      const monthStart = startOfMonth(itemDate);
      groupKey = formatDate(monthStart, 'yyyy-MM-dd');
    } else {
      groupKey = item.date;
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item.value);
  });

  return Object.entries(groups).map(([date, vals]) => ({
    date,
    values: vals
  }));
}

// Calculate aggregations for field values
function calculateFieldAggregations(values, groupBy, fieldType = 'number') {
  const grouped = groupFieldValuesByPeriod(values, groupBy);

  return grouped.map(group => {
    const vals = group.values;

    if (fieldType === 'boolean') {
      // For boolean fields, calculate true/false counts
      const trueCount = vals.filter(v => v === true).length;
      const falseCount = vals.filter(v => v === false).length;
      const totalCount = vals.length;
      const truePercentage = totalCount > 0 ? (trueCount / totalCount) * 100 : 0;

      return {
        date: group.date,
        value: group.value !== undefined ? group.value : null,
        trueCount,
        falseCount,
        totalCount,
        truePercentage,
        count: vals.length
      };
    } else if (fieldType === 'number' || fieldType === 'currency') {
      // For numeric fields, calculate min/max/avg/sum
      return {
        date: group.date,
        value: group.value !== undefined ? group.value : null,
        min: Math.min(...vals),
        max: Math.max(...vals),
        avg: vals.reduce((a, b) => a + b, 0) / vals.length,
        sum: vals.reduce((a, b) => a + b, 0),
        count: vals.length
      };
    } else {
      // For text, date, time, datetime - calculate counts and unique values
      const uniqueValues = [...new Set(vals)];
      const valueCounts = {};
      vals.forEach(v => {
        valueCounts[v] = (valueCounts[v] || 0) + 1;
      });
      const mostCommon = Object.entries(valueCounts).sort((a, b) => b[1] - a[1])[0];

      return {
        date: group.date,
        value: group.value !== undefined ? group.value : null,
        count: vals.length,
        uniqueCount: uniqueValues.length,
        mostCommonValue: mostCommon ? mostCommon[0] : null,
        mostCommonCount: mostCommon ? mostCommon[1] : 0
      };
    }
  });
}

// Calculate summary statistics for field values
function calculateFieldSummary(data, fieldType = 'number') {
  if (data.length === 0) {
    return {
      overall_min: null,
      overall_max: null,
      overall_avg: null,
      overall_sum: null,
      total_count: 0,
      trend: 'unknown',
      change_percent: 0
    };
  }

  const allValues = data.flatMap(d => d.values || [d.value]).filter(v => v !== null && v !== undefined);

  if (fieldType === 'boolean') {
    // For boolean fields, calculate overall true/false counts
    const overallTrueCount = allValues.filter(v => v === true).length;
    const overallFalseCount = allValues.filter(v => v === false).length;
    const totalCount = allValues.length;
    const overallTruePercentage = totalCount > 0 ? (overallTrueCount / totalCount) * 100 : 0;

    return {
      overall_true_count: overallTrueCount,
      overall_false_count: overallFalseCount,
      overall_true_percentage: overallTruePercentage,
      total_count: totalCount,
      trend: 'boolean',
      change_percent: 0
    };
  }

  if (fieldType === 'number' || fieldType === 'currency') {
    // For numeric fields, calculate min/max/avg/sum
    const summary = {
      overall_min: Math.min(...allValues),
      overall_max: Math.max(...allValues),
      overall_avg: allValues.reduce((a, b) => a + b, 0) / allValues.length,
      overall_sum: allValues.reduce((a, b) => a + b, 0),
      total_count: allValues.length,
      trend: 'unknown',
      change_percent: 0
    };

    // Calculate trend
    if (data.length >= 2) {
      const firstValue = data[0].avg || data[0].value;
      const lastValue = data[data.length - 1].avg || data[data.length - 1].value;

      if (lastValue > firstValue) {
        summary.trend = 'increasing';
      } else if (lastValue < firstValue) {
        summary.trend = 'decreasing';
      } else {
        summary.trend = 'stable';
      }

      summary.change_percent = firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
    }

    return summary;
  }

  // For text, date, time, datetime - calculate unique counts
  const uniqueValues = [...new Set(allValues)];
  const valueCounts = {};
  allValues.forEach(v => {
    valueCounts[v] = (valueCounts[v] || 0) + 1;
  });
  const mostCommon = Object.entries(valueCounts).sort((a, b) => b[1] - a[1])[0];

  return {
    total_count: allValues.length,
    unique_count: uniqueValues.length,
    most_common_value: mostCommon ? mostCommon[0] : null,
    most_common_count: mostCommon ? mostCommon[1] : 0,
    trend: 'categorical',
    change_percent: 0
  };
}

// ============================================================================
// POINTS REDEMPTIONS
// ============================================================================

function getTotalPointsEarned(userId) {
  const result = db.prepare(`
    SELECT COALESCE(SUM(points), 0) as total
    FROM daily_tasks
    WHERE user_id = ? AND done = 1 AND points > 0
  `).get(userId);
  return result.total || 0;
}

function getTotalPointsRedeemed(userId) {
  const result = db.prepare(`
    SELECT COALESCE(SUM(points_cost), 0) as total
    FROM points_redemptions
    WHERE user_id = ?
  `).get(userId);
  return result.total || 0;
}

function getPointsBalance(userId) {
  const earned = getTotalPointsEarned(userId);
  const redeemed = getTotalPointsRedeemed(userId);
  return earned - redeemed;
}

function createRedemption(userId, rewardDescription, pointsCost) {
  const result = db.prepare(
    'INSERT INTO points_redemptions (user_id, reward_description, points_cost) VALUES (?, ?, ?)'
  ).run(userId, rewardDescription, pointsCost);
  return result.lastInsertRowid;
}

function getRedemptions(userId) {
  return db.prepare(`
    SELECT id, reward_description, points_cost, redeemed_at
    FROM points_redemptions
    WHERE user_id = ?
    ORDER BY redeemed_at DESC
  `).all(userId);
}

function deleteRedemption(redemptionId, userId) {
  // Verify the redemption belongs to this user before deleting
  const redemption = db.prepare('SELECT user_id FROM points_redemptions WHERE id = ?').get(redemptionId);

  if (!redemption || redemption.user_id !== userId) {
    throw new Error('Redemption not found or does not belong to user');
  }

  // Delete the redemption (will also set redemption_id to NULL in linked tasks due to ON DELETE SET NULL)
  const result = db.prepare('DELETE FROM points_redemptions WHERE id = ?').run(redemptionId);
  return result.changes > 0;
}

module.exports = {
  // Users
  getAllUsers,
  getUserById,
  getUserByUsername,
  getUserByEmail,
  getUserSettings,
  updateUserSettings,
  createUser,
  updateUser,
  deleteUser,

  // Profile fields
  getProfileFields,
  setProfileField,
  deleteProfileField,

  // Custom field templates
  getCustomFieldTemplates,
  getCustomFieldTemplate,
  createCustomFieldTemplate,
  deleteCustomFieldTemplate,

  // Time since trackers
  getTimeSinceTrackers,
  createTimeSinceTracker,
  deleteTimeSinceTracker,

  // Duration trackers
  getDurationTrackers,
  createDurationTracker,
  updateDurationTracker,
  deleteDurationTracker,

  // Custom counters
  getCustomCounters,
  createCustomCounter,
  deleteCustomCounter,
  getCustomCounterValue,
  setCustomCounterValue,

  // Daily state
  getDailyState,
  setDailyState,

  // Daily custom fields
  getDailyCustomFields,
  setDailyCustomField,
  deleteDailyCustomField,
  deleteDailyCustomFieldById,

  // Daily tasks
  getDailyTasks,
  createDailyTask,
  updateDailyTask,
  toggleDailyTask,
  deleteDailyTask,

  // Activity entries
  getActivityEntries,
  createActivityEntry,
  updateActivityEntry,
  deleteActivityEntry,

  // Snapshot settings
  getSnapshotSettings,
  setSnapshotSettings,

  // Snapshots
  getSnapshots,
  getSnapshot,
  saveSnapshot,
  deleteSnapshot,

  // Reordering
  reorderItems,

  // Queries and Analytics
  queryTasks,
  queryFieldValues,
  getPopulatedFieldsInRange,
  calculateFieldAggregations,
  calculateFieldSummary,

  // Custom field templates
  updateCustomFieldTemplate,

  // Points Redemptions
  getTotalPointsEarned,
  getTotalPointsRedeemed,
  getPointsBalance,
  createRedemption,
  getRedemptions,
  deleteRedemption
};
