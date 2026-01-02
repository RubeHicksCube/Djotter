const { db } = require('../database');
const dataAccess = require('../dataAccess');

console.log('🌱 Seeding historical field data...\n');

const userId = 1;
const user = dataAccess.getUserById(userId);

if (!user) {
  console.error('❌ User not found');
  process.exit(1);
}

console.log(`📝 Creating field data for user: ${user.username}\n`);

// Define field templates
const fieldTemplates = [
  // Currency fields
  { key: 'Daily Spending', field_type: 'currency', minValue: 5, maxValue: 150 },
  { key: 'Income Today', field_type: 'currency', minValue: 0, maxValue: 500 },
  { key: 'Savings', field_type: 'currency', minValue: 10, maxValue: 200 },

  // Numeric fields
  { key: 'Steps Walked', field_type: 'number', minValue: 2000, maxValue: 15000 },
  { key: 'Hours of Sleep', field_type: 'number', minValue: 4, maxValue: 10 },
  { key: 'Productivity Score', field_type: 'number', minValue: 1, maxValue: 10 },
  { key: 'Mood Rating', field_type: 'number', minValue: 1, maxValue: 10 },
  { key: 'Calories Consumed', field_type: 'number', minValue: 1200, maxValue: 3500 },

  // Text fields
  { key: 'Daily Highlight', field_type: 'text', values: [
    'Completed important project milestone',
    'Had a great conversation with a friend',
    'Learned something new today',
    'Helped someone in need',
    'Made progress on personal goals',
    'Enjoyed quality time with family',
    'Solved a challenging problem',
    'Received positive feedback',
    'Took time for self-care',
    'Had a productive day overall'
  ]},
  { key: 'Weather', field_type: 'text', values: ['Sunny', 'Cloudy', 'Rainy', 'Partly Cloudy', 'Stormy', 'Clear'] },
  { key: 'Location', field_type: 'text', values: ['Home', 'Office', 'Coffee Shop', 'Library', 'Park', 'Gym'] }
];

function randomValue(field) {
  if (field.field_type === 'text') {
    return field.values[Math.floor(Math.random() * field.values.length)];
  } else if (field.field_type === 'currency') {
    const value = Math.floor(Math.random() * (field.maxValue - field.minValue + 1)) + field.minValue;
    return value.toFixed(2);
  } else {
    return String(Math.floor(Math.random() * (field.maxValue - field.minValue + 1)) + field.minValue);
  }
}

// Get all existing snapshots to populate data for those dates
const snapshots = db.prepare('SELECT date FROM snapshots WHERE user_id = ? ORDER BY date').all(userId);

if (snapshots.length === 0) {
  console.error('❌ No snapshots found. Run seedSnapshots.js first.');
  process.exit(1);
}

console.log(`📅 Found ${snapshots.length} snapshot dates\n`);

// Clear existing field templates and data
console.log('🧹 Cleaning up existing field templates...');
db.prepare('DELETE FROM custom_field_templates WHERE user_id = ? AND key NOT IN (?, ?, ?, ?, ?)').run(
  userId, 'Energy Level', 'Focus Score', 'Stress Level', 'Exercise Minutes', 'Water Intake'
);

// Create new field templates
console.log('📋 Creating field templates...\n');
fieldTemplates.forEach((field, index) => {
  const existing = db.prepare('SELECT id FROM custom_field_templates WHERE user_id = ? AND key = ?')
    .get(userId, field.key);

  if (existing) {
    console.log(`  ⚠️  Template already exists: ${field.key} (${field.field_type})`);
  } else {
    db.prepare('INSERT INTO custom_field_templates (user_id, key, field_type, order_index) VALUES (?, ?, ?, ?)')
      .run(userId, field.key, field.field_type, index + 100);
    console.log(`  ✅ Created template: ${field.key} (${field.field_type})`);
  }
});

console.log('\n📊 Populating historical field data...\n');

// Populate field values for each snapshot date
snapshots.forEach(snapshot => {
  const date = snapshot.date;
  console.log(`  📅 ${date}`);

  fieldTemplates.forEach(field => {
    const value = randomValue(field);

    // Insert or update daily custom field value
    db.prepare(`
      INSERT OR REPLACE INTO daily_custom_fields
      (user_id, date, key, value, field_type, is_template, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, date, field.key, value, field.field_type, 1, 0);
  });

  console.log(`    ✅ Populated ${fieldTemplates.length} field values`);
});

// Update snapshots with new field data
console.log('\n🔄 Updating snapshots with new field data...\n');

snapshots.forEach(snapshot => {
  const date = snapshot.date;

  // Get the snapshot state
  const snapshotRow = db.prepare('SELECT state_json FROM snapshots WHERE user_id = ? AND date = ?')
    .get(userId, date);

  if (snapshotRow) {
    const state = JSON.parse(snapshotRow.state_json);

    // Get all custom fields for this date
    const templates = db.prepare('SELECT * FROM custom_field_templates WHERE user_id = ? ORDER BY order_index').all(userId);
    const dailyFieldsFromDB = db.prepare('SELECT * FROM daily_custom_fields WHERE user_id = ? AND date = ? ORDER BY order_index').all(userId, date);

    const customFields = templates.map(template => {
      const valueField = dailyFieldsFromDB.find(f => f.key === template.key);
      return {
        id: template.id,
        key: template.key,
        value: valueField ? valueField.value : '',
        field_type: template.field_type || 'text'
      };
    });

    // Update state with new custom fields
    state.customFields = customFields;

    // Save updated snapshot
    db.prepare('UPDATE snapshots SET state_json = ? WHERE user_id = ? AND date = ?')
      .run(JSON.stringify(state), userId, date);

    console.log(`  ✅ Updated snapshot for ${date}`);
  }
});

// Summary
const totalTemplates = db.prepare('SELECT COUNT(*) as count FROM custom_field_templates WHERE user_id = ?')
  .get(userId).count;
const totalValues = db.prepare('SELECT COUNT(*) as count FROM daily_custom_fields WHERE user_id = ?')
  .get(userId).count;

console.log('\n✅ Seeding complete!');
console.log(`📊 Total field templates: ${totalTemplates}`);
console.log(`📈 Total field values: ${totalValues}`);
console.log(`📅 Dates with data: ${snapshots.length}`);
console.log('\n🎉 Ready to test field queries!');

process.exit(0);
