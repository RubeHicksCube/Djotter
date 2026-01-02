const { db } = require('../database');

console.log('🧹 Cleaning up test data for user ID 1...\n');

const userId = 1;

// Delete in order to respect foreign key constraints
db.prepare('DELETE FROM snapshots WHERE user_id = ?').run(userId);
console.log('✅ Deleted snapshots');

db.prepare('DELETE FROM custom_counter_values WHERE user_id = ?').run(userId);
console.log('✅ Deleted counter values');

db.prepare('DELETE FROM activity_entries WHERE user_id = ?').run(userId);
console.log('✅ Deleted activity entries');

db.prepare('DELETE FROM daily_tasks WHERE user_id = ?').run(userId);
console.log('✅ Deleted daily tasks');

db.prepare('DELETE FROM daily_custom_fields WHERE user_id = ?').run(userId);
console.log('✅ Deleted daily custom fields');

db.prepare('DELETE FROM daily_state WHERE user_id = ?').run(userId);
console.log('✅ Deleted daily state');

console.log('\n✨ Cleanup complete!');
