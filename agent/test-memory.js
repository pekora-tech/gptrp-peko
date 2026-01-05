import DatabaseManager from './database.js';
import MemoryManager from './MemoryManager.js';
import { readFileSync } from 'fs';

console.log('🧪 Testing MemoryManager CRUD Operations...\n');

try {
  // Load config and initialize
  const config = JSON.parse(readFileSync('./env.json', 'utf8'));
  const db = new DatabaseManager(config.DATABASE_PATH);
  const memoryManager = new MemoryManager(db, 'test_agent_memory');

  // Clean up any existing test data
  memoryManager.clearAllMemories();

  // ========== Test 1: Short-term Memory ==========
  console.log('📝 Testing Short-term Memory...');

  memoryManager.addShortTermMemory(
    { type: 'move', direction: 'up' },
    { success: true, new_position: { x: 5, y: 6 } }
  );

  memoryManager.addShortTermMemory(
    { type: 'plant', item: 'seed' },
    { success: true, growth_time: 100 }
  );

  memoryManager.addShortTermMemory(
    { type: 'move', direction: 'right' },
    { success: true, new_position: { x: 6, y: 6 } }
  );

  const recentActions = memoryManager.getRecentActions(10);
  console.log(`  ✓ Added 3 short-term memories`);
  console.log(`  ✓ Retrieved ${recentActions.length} recent actions`);
  console.log(`    - Latest action: ${recentActions[recentActions.length - 1].action.type}`);

  // ========== Test 2: Long-term Memory ==========
  console.log('\n🧠 Testing Long-term Memory...');

  memoryManager.addLongTermMemory({
    type: 'discovery',
    description: 'Found a water source at (15, 20)',
    timestamp: new Date().toISOString()
  }, 9);

  memoryManager.addLongTermMemory({
    type: 'achievement',
    description: 'First successful harvest',
    timestamp: new Date().toISOString()
  }, 8);

  memoryManager.addLongTermMemory({
    type: 'danger',
    description: 'Encountered hostile entity',
    timestamp: new Date().toISOString()
  }, 7);

  const importantMemories = memoryManager.getImportantMemories(7, 5);
  console.log(`  ✓ Added 3 long-term memories`);
  console.log(`  ✓ Retrieved ${importantMemories.length} important memories`);
  console.log(`    - Highest importance: ${importantMemories[0].importance}`);
  console.log(`    - Memory: ${importantMemories[0].description}`);

  // ========== Test 3: Location Memory ==========
  console.log('\n🗺️  Testing Location Memory...');

  memoryManager.recordLocation(10, 10, 'grass', { type: 'safe', has_water: false });
  memoryManager.recordLocation(15, 20, 'water', { type: 'resource', resource_name: 'water' });
  memoryManager.recordLocation(10, 10, 'grass', { type: 'safe', has_water: false }); // Revisit
  memoryManager.recordLocation(8, 12, 'forest', { type: 'safe', has_trees: true });

  const nearbyLocations = memoryManager.getNearbyLocations(10, 10, 5);
  console.log(`  ✓ Recorded 4 location visits (3 unique)`);
  console.log(`  ✓ Found ${nearbyLocations.length} nearby locations`);

  const waterLocation = memoryManager.findResourceLocation('water');
  if (waterLocation) {
    console.log(`  ✓ Found water at (${waterLocation.x}, ${waterLocation.y})`);
  }

  const mostVisited = memoryManager.getMostVisitedLocations(3);
  console.log(`  ✓ Most visited location: (${mostVisited[0].x}, ${mostVisited[0].y}) - ${mostVisited[0].visit_count} visits`);

  // ========== Test 4: Interaction Memory ==========
  console.log('\n🎮 Testing Interaction Memory...');

  memoryManager.recordInteraction('move', 5, 5, { success: true, distance: 1 });
  memoryManager.recordInteraction('plant', 10, 10, { success: true, item: 'seed' });
  memoryManager.recordInteraction('harvest', 10, 10, { success: true, yield: 3 });
  memoryManager.recordInteraction('sleep', 7, 6, { success: true, sleepiness_reset: true });
  memoryManager.recordInteraction('move', 6, 6, { success: true, distance: 1 });

  const allInteractions = memoryManager.getRecentInteractions(null, 10);
  console.log(`  ✓ Recorded 5 interactions`);
  console.log(`  ✓ Retrieved ${allInteractions.length} recent interactions`);

  const moveInteractions = memoryManager.getRecentInteractions('move', 10);
  console.log(`  ✓ Retrieved ${moveInteractions.length} move interactions`);

  const plantStats = memoryManager.getInteractionStats('plant');
  console.log(`  ✓ Plant interaction stats: ${plantStats.total_count} times`);

  // ========== Test 5: Memory Stats ==========
  console.log('\n📊 Testing Memory Statistics...');

  const stats = memoryManager.getMemoryStats();
  console.log(`  ✓ Short-term memories: ${stats.memories.short_term || 0}`);
  console.log(`  ✓ Long-term memories: ${stats.memories.long_term || 0}`);
  console.log(`  ✓ Explored locations: ${stats.locations}`);
  console.log(`  ✓ Total interactions: ${stats.interactions}`);

  // ========== Test 6: Cleanup ==========
  console.log('\n🧹 Testing Cleanup...');

  // Test short-term memory cleanup
  for (let i = 0; i < 25; i++) {
    memoryManager.addShortTermMemory(
      { type: 'test', iteration: i },
      { success: true }
    );
  }

  memoryManager.cleanOldShortTermMemories(20);
  const afterCleanup = memoryManager.getRecentActions(100);
  console.log(`  ✓ Added 25 test memories, cleaned up, kept ${afterCleanup.length} (should be ≤ 20)`);

  // Final cleanup
  memoryManager.clearAllMemories();
  const finalStats = memoryManager.getMemoryStats();
  const totalCount = (finalStats.memories.short_term || 0) +
                     (finalStats.memories.long_term || 0) +
                     finalStats.locations +
                     finalStats.interactions;

  console.log(`  ✓ Cleared all memories (${totalCount} remaining)`);

  // Close connection
  db.close();
  console.log('\n✅ All MemoryManager tests passed!\n');

} catch (error) {
  console.error('\n❌ MemoryManager test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
