import DatabaseManager from './database.js';
import GoalManager from './GoalManager.js';
import { readFileSync } from 'fs';

console.log('🧪 Testing GoalManager...\n');

try {
  // Load config and initialize
  const config = JSON.parse(readFileSync('./env.json', 'utf8'));
  const db = new DatabaseManager(config.DATABASE_PATH);
  const goalManager = new GoalManager(db, 'test_agent_goals');

  // Clean up any existing test data
  goalManager.clearAllGoals();

  // ========== Test 1: Create Goals ==========
  console.log('🎯 Testing Goal Creation...');

  const goal1 = goalManager.createGoal(
    'Find a safe place to sleep',
    'survival',
    8,
    { target_location: { x: 7, y: 6 } }
  );

  const goal2 = goalManager.createGoal(
    'Explore the northern forest',
    'exploration',
    6,
    { target_count: 10, explored_count: 0 }
  );

  const goal3 = goalManager.createGoal(
    'Collect 5 seeds',
    'resource',
    7,
    { resource_type: 'seeds', target_amount: 5 }
  );

  console.log(`  ✓ Created 3 goals (IDs: ${goal1}, ${goal2}, ${goal3})`);

  // ========== Test 2: Get Current Goal ==========
  console.log('\n📋 Testing Get Current Goal...');

  const currentGoal = goalManager.getCurrentGoal();
  console.log(`  ✓ Current goal (highest priority): "${currentGoal.description}"`);
  console.log(`    - Type: ${currentGoal.goal_type}`);
  console.log(`    - Priority: ${currentGoal.priority}`);
  console.log(`    - Status: ${currentGoal.status}`);

  // ========== Test 3: Get All Active Goals ==========
  console.log('\n📚 Testing Get All Active Goals...');

  const activeGoals = goalManager.getActiveGoals();
  console.log(`  ✓ Retrieved ${activeGoals.length} active goals`);
  activeGoals.forEach((goal, i) => {
    console.log(`    ${i + 1}. [Priority ${goal.priority}] ${goal.description}`);
  });

  // ========== Test 4: Update Goal Priority ==========
  console.log('\n⬆️  Testing Update Goal Priority...');

  goalManager.updateGoalPriority(goal2, 10);
  const updatedGoal = goalManager.getGoal(goal2);
  console.log(`  ✓ Updated goal ${goal2} priority to ${updatedGoal.priority}`);

  const newCurrentGoal = goalManager.getCurrentGoal();
  console.log(`  ✓ New current goal: "${newCurrentGoal.description}" (priority ${newCurrentGoal.priority})`);

  // ========== Test 5: Goal Completion Detection ==========
  console.log('\n✅ Testing Goal Completion Detection...');

  // Test navigation goal
  let state1 = { position: { x: 7, y: 6 }, sleepiness: 5 };
  goalManager.updateGoalPriority(goal1, 10); // Make it highest priority

  let check1 = goalManager.checkGoalCompletion(state1);
  console.log(`  ✓ Navigation goal check: ${check1.completed ? 'COMPLETED' : 'Not completed'}`);
  if (check1.completed) {
    console.log(`    - Reason: ${check1.reason}`);
  }

  // Test sleep goal
  const sleepGoal = goalManager.createGoal(
    'Rest until fully recovered',
    'sleep',
    9
  );

  let state2 = { position: { x: 7, y: 6 }, sleepiness: 0 };
  let check2 = goalManager.checkGoalCompletion(state2);
  console.log(`  ✓ Sleep goal check: ${check2.completed ? 'COMPLETED' : 'Not completed'}`);
  if (check2.completed) {
    console.log(`    - Reason: ${check2.reason}`);
  }

  // Test resource goal
  goalManager.updateGoalPriority(goal3, 10);
  let state3 = { position: { x: 10, y: 10 }, inventory: { seeds: 5 } };
  let check3 = goalManager.checkGoalCompletion(state3);
  console.log(`  ✓ Resource goal check: ${check3.completed ? 'COMPLETED' : 'Not completed'}`);
  if (check3.completed) {
    console.log(`    - Reason: ${check3.reason}`);
  }

  // ========== Test 6: Goal Status Updates ==========
  console.log('\n🔄 Testing Goal Status Updates...');

  const testGoal = goalManager.createGoal('Test goal', 'general', 5);
  console.log(`  ✓ Created test goal ID: ${testGoal}`);

  goalManager.abandonGoal(testGoal);
  let abandonedGoal = goalManager.getGoal(testGoal);
  console.log(`  ✓ Abandoned goal status: ${abandonedGoal.status}`);

  const testGoal2 = goalManager.createGoal('Another test goal', 'general', 5);
  goalManager.failGoal(testGoal2);
  let failedGoal = goalManager.getGoal(testGoal2);
  console.log(`  ✓ Failed goal status: ${failedGoal.status}`);

  // ========== Test 7: Get Completed Goals ==========
  console.log('\n🏆 Testing Get Completed Goals...');

  const completedGoals = goalManager.getCompletedGoals();
  console.log(`  ✓ Retrieved ${completedGoals.length} completed goals`);
  completedGoals.forEach((goal, i) => {
    console.log(`    ${i + 1}. "${goal.description}" - Completed at ${goal.completed_at}`);
  });

  // ========== Test 8: Goal Statistics ==========
  console.log('\n📊 Testing Goal Statistics...');

  const stats = goalManager.getGoalStats();
  console.log(`  ✓ Total goals: ${stats.total}`);
  console.log(`    - Active: ${stats.active}`);
  console.log(`    - Completed: ${stats.completed}`);
  console.log(`    - Failed: ${stats.failed}`);
  console.log(`    - Abandoned: ${stats.abandoned}`);

  // ========== Test 9: Update Goal Metadata ==========
  console.log('\n📝 Testing Update Goal Metadata...');

  const metaGoal = goalManager.createGoal(
    'Test metadata goal',
    'exploration',
    5,
    { explored_count: 0, target_count: 5 }
  );

  goalManager.updateGoalMetadata(metaGoal, { explored_count: 3, target_count: 5 });
  const updatedMetaGoal = goalManager.getGoal(metaGoal);
  console.log(`  ✓ Updated metadata: explored ${updatedMetaGoal.metadata.explored_count}/${updatedMetaGoal.metadata.target_count}`);

  // ========== Test 10: Cleanup ==========
  console.log('\n🧹 Testing Cleanup...');

  goalManager.clearInactiveGoals();
  const afterCleanup = goalManager.getGoalStats();
  console.log(`  ✓ Cleared inactive goals`);
  console.log(`    - Remaining active: ${afterCleanup.active}`);
  console.log(`    - Removed completed/failed/abandoned: ${stats.completed + stats.failed + stats.abandoned}`);

  // Final cleanup
  goalManager.clearAllGoals();
  const finalStats = goalManager.getGoalStats();
  console.log(`  ✓ Cleared all goals (${finalStats.total} remaining)`);

  // Close connection
  db.close();
  console.log('\n✅ All GoalManager tests passed!\n');

} catch (error) {
  console.error('\n❌ GoalManager test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
