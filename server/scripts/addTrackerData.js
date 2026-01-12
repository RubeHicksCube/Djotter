#!/usr/bin/env node

/**
 * Add test timer and counter data to existing snapshots
 * This script adds sample timers and counters to snapshots in 2026
 */

const { db } = require('../database');

const userId = 1; // admin user

console.log('🔄 Adding tracker data to snapshots...\n');

// Get all snapshots for 2026
const snapshots = db.prepare(`
  SELECT date, state_json FROM snapshots
  WHERE user_id = ? AND date >= '2026-01-01' AND date < '2027-01-01'
  ORDER BY date
`).all(userId);

console.log(`📊 Found ${snapshots.length} snapshots in 2026\n`);

if (snapshots.length === 0) {
  console.log('❌ No snapshots found for 2026. Run seedSnapshots.js first.');
  process.exit(1);
}

// First, create counter templates if they don't exist
const existingCounters = db.prepare('SELECT name FROM custom_counters WHERE user_id = ?').all(userId);
const existingCounterNames = existingCounters.map(c => c.name);

const testCounters = ['Work Sessions', 'Coffee Cups', 'Steps (x1000)'];
testCounters.forEach(name => {
  if (!existingCounterNames.includes(name)) {
    try {
      db.prepare('INSERT INTO custom_counters (user_id, name) VALUES (?, ?)').run(userId, name);
      console.log(`✅ Created counter: "${name}"`);
    } catch (err) {
      console.log(`⚠️  Counter "${name}" may already exist`);
    }
  }
});

// Get counter IDs
const counters = db.prepare('SELECT id, name FROM custom_counters WHERE user_id = ?').all(userId);
const counterMap = {};
counters.forEach(c => {
  counterMap[c.name] = c.id;
});

console.log('');

// Update each snapshot with tracker data
let updatedCount = 0;

snapshots.forEach((snapshot, index) => {
  const state = JSON.parse(snapshot.state_json);
  const date = snapshot.date;

  // Add duration trackers (timers) if they don't exist
  if (!state.durationTrackers || state.durationTrackers.length === 0) {
    // Create sample timers with varying values
    const dayOfYear = new Date(date).getTime();
    const seed = dayOfYear % 100;

    state.durationTrackers = [
      {
        id: 1,
        name: 'Deep Work',
        type: 'timer',
        is_running: false,
        start_time: null,
        elapsed_ms: (60 + (seed % 30)) * 60 * 1000, // 60-90 minutes in ms
        value: 0
      },
      {
        id: 2,
        name: 'Exercise',
        type: 'timer',
        is_running: false,
        start_time: null,
        elapsed_ms: (30 + (seed % 20)) * 60 * 1000, // 30-50 minutes in ms
        value: 0
      },
      {
        id: 3,
        name: 'Reading',
        type: 'timer',
        is_running: false,
        start_time: null,
        elapsed_ms: (15 + (seed % 25)) * 60 * 1000, // 15-40 minutes in ms
        value: 0
      }
    ];
  }

  // Add custom counters if they don't exist
  if (!state.customCounters || state.customCounters.length === 0) {
    const dayOfYear = new Date(date).getTime();
    const seed = dayOfYear % 100;

    state.customCounters = [
      {
        id: counterMap['Work Sessions'],
        name: 'Work Sessions',
        value: 3 + (seed % 5) // 3-7 sessions
      },
      {
        id: counterMap['Coffee Cups'],
        name: 'Coffee Cups',
        value: 1 + (seed % 4) // 1-4 cups
      },
      {
        id: counterMap['Steps (x1000)'],
        name: 'Steps (x1000)',
        value: 5 + (seed % 8) // 5-12 (x1000 steps, so 5000-12000 steps)
      }
    ];

    // Also save counter values to custom_counter_values table
    state.customCounters.forEach(counter => {
      try {
        db.prepare(`
          INSERT INTO custom_counter_values (counter_id, user_id, date, value)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(counter_id, date) DO UPDATE SET value = excluded.value
        `).run(counter.id, userId, date, counter.value);
      } catch (err) {
        // Counter value may already exist
      }
    });
  }

  // Save updated snapshot
  db.prepare(`
    UPDATE snapshots
    SET state_json = ?
    WHERE user_id = ? AND date = ?
  `).run(JSON.stringify(state), userId, date);

  updatedCount++;

  if (updatedCount % 10 === 0) {
    console.log(`✅ Updated ${updatedCount}/${snapshots.length} snapshots...`);
  }
});

console.log(`\n✅ Successfully updated ${updatedCount} snapshots with tracker data!`);
console.log('\n📊 Tracker Summary:');
console.log('  Timers: Deep Work (60-90 min), Exercise (30-50 min), Reading (15-40 min)');
console.log('  Counters: Work Sessions (3-7), Coffee Cups (1-4), Steps (5-12K)');
console.log('\n💡 Values vary by date to show realistic trends in queries.');
