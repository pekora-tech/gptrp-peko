import DatabaseManager from './database.js';
import { readFileSync } from 'fs';

console.log('🧪 Testing Database Connection and Schema...\n');

try {
  // Load config
  const config = JSON.parse(readFileSync('./env.json', 'utf8'));

  // Initialize database
  const db = new DatabaseManager(config.DATABASE_PATH);
  console.log('✓ Database connection established');

  // Test 1: Verify tables exist
  console.log('\n📋 Verifying tables...');
  const tables = db.all(`
    SELECT name FROM sqlite_master
    WHERE type='table'
    ORDER BY name
  `);

  console.log('Tables created:', tables.map(t => t.name).join(', '));

  const expectedTables = ['memories', 'goals', 'explored_locations', 'interactions'];
  const actualTables = tables.map(t => t.name);

  for (const table of expectedTables) {
    if (actualTables.includes(table)) {
      console.log(`  ✓ ${table} table exists`);
    } else {
      console.log(`  ✗ ${table} table missing!`);
    }
  }

  // Test 2: Insert test data
  console.log('\n🔬 Testing data insertion...');

  // Test memory insert
  const memoryResult = db.run(`
    INSERT INTO memories (agent_id, memory_type, content, importance)
    VALUES (?, ?, ?, ?)
  `, ['test_agent', 'short_term', JSON.stringify({ test: 'data' }), 5]);

  console.log(`  ✓ Inserted memory with ID: ${memoryResult.lastInsertRowid}`);

  // Test goal insert
  const goalResult = db.run(`
    INSERT INTO goals (agent_id, goal_type, description, priority)
    VALUES (?, ?, ?, ?)
  `, ['test_agent', 'survival', 'Find food', 8]);

  console.log(`  ✓ Inserted goal with ID: ${goalResult.lastInsertRowid}`);

  // Test location insert
  const locationResult = db.run(`
    INSERT INTO explored_locations (agent_id, x, y, tile_type)
    VALUES (?, ?, ?, ?)
  `, ['test_agent', 10, 20, 'grass']);

  console.log(`  ✓ Inserted location with ID: ${locationResult.lastInsertRowid}`);

  // Test interaction insert
  const interactionResult = db.run(`
    INSERT INTO interactions (agent_id, interaction_type, location_x, location_y, result)
    VALUES (?, ?, ?, ?, ?)
  `, ['test_agent', 'move', 5, 5, JSON.stringify({ success: true })]);

  console.log(`  ✓ Inserted interaction with ID: ${interactionResult.lastInsertRowid}`);

  // Test 3: Query data back
  console.log('\n📖 Testing data retrieval...');

  const memories = db.all(`SELECT * FROM memories WHERE agent_id = ?`, ['test_agent']);
  console.log(`  ✓ Retrieved ${memories.length} memory record(s)`);

  const goals = db.all(`SELECT * FROM goals WHERE agent_id = ?`, ['test_agent']);
  console.log(`  ✓ Retrieved ${goals.length} goal record(s)`);

  const locations = db.all(`SELECT * FROM explored_locations WHERE agent_id = ?`, ['test_agent']);
  console.log(`  ✓ Retrieved ${locations.length} location record(s)`);

  const interactions = db.all(`SELECT * FROM interactions WHERE agent_id = ?`, ['test_agent']);
  console.log(`  ✓ Retrieved ${interactions.length} interaction record(s)`);

  // Test 4: Clean up test data
  console.log('\n🧹 Cleaning up test data...');
  db.run(`DELETE FROM memories WHERE agent_id = ?`, ['test_agent']);
  db.run(`DELETE FROM goals WHERE agent_id = ?`, ['test_agent']);
  db.run(`DELETE FROM explored_locations WHERE agent_id = ?`, ['test_agent']);
  db.run(`DELETE FROM interactions WHERE agent_id = ?`, ['test_agent']);
  console.log('  ✓ Test data cleaned up');

  // Close connection
  db.close();
  console.log('\n✅ All database tests passed!\n');

} catch (error) {
  console.error('\n❌ Database test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
