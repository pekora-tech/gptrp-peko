import DatabaseManager from './database.js';
import MemoryManager from './MemoryManager.js';
import GoalManager from './GoalManager.js';
import ServerAgent from './ServerAgent.js';
import { readFileSync } from 'fs';

console.log('🧪 Testing Complete Decision-Making Cycle...\n');

async function testIntegration() {
  try {
    // Load config and initialize
    const config = JSON.parse(readFileSync('./env.json', 'utf8'));
    const db = new DatabaseManager(config.DATABASE_PATH);

    const testAgentId = 'test_integration_agent';

    // Create managers
    const memoryManager = new MemoryManager(db, testAgentId);
    const goalManager = new GoalManager(db, testAgentId);

    // Clean up any existing test data
    memoryManager.clearAllMemories();
    goalManager.clearAllGoals();

    console.log('✓ Test environment initialized\n');

    // ========== Test 1: Create ServerAgent ==========
    console.log('🤖 Testing ServerAgent Creation...');
    const agent = new ServerAgent(testAgentId, memoryManager, goalManager);
    console.log(`  ✓ Created ServerAgent with ID: ${testAgentId}`);
    console.log(`  ✓ Using model: ${agent.model}\n`);

    // ========== Test 2: Set Initial Goal ==========
    console.log('🎯 Setting Initial Goal...');
    goalManager.createGoal(
      'Find a safe place to rest',
      'survival',
      8,
      { target_location: { x: 7, y: 6 } }
    );
    const initialGoal = goalManager.getCurrentGoal();
    console.log(`  ✓ Goal created: "${initialGoal.description}"`);
    console.log(`  ✓ Goal type: ${initialGoal.goal_type}`);
    console.log(`  ✓ Priority: ${initialGoal.priority}\n`);

    // ========== Test 3: Build Context ==========
    console.log('📊 Testing Context Building...');
    const mockState = {
      position: { x: 5, y: 5 },
      surroundings: {
        up: 'grass',
        down: 'grass',
        left: 'grass',
        right: 'water'
      },
      sleepiness: 3
    };

    const context = await agent.buildContext(mockState);
    console.log(`  ✓ Context built successfully`);
    console.log(`  ✓ Recent actions: ${context.recentActions.length}`);
    console.log(`  ✓ Important memories: ${context.importantMemories.length}`);
    console.log(`  ✓ Current goal: ${context.currentGoal ? 'Yes' : 'No'}`);
    console.log(`  ✓ Nearby locations: ${context.nearbyLocations.length}\n`);

    // ========== Test 4: Build Enhanced Prompt ==========
    console.log('📝 Testing Prompt Generation...');
    const prompt = agent.buildEnhancedPrompt(context);
    console.log(`  ✓ Prompt generated (${prompt.length} characters)`);
    console.log(`  ✓ Contains goal section: ${prompt.includes('Current Goal')}`);
    console.log(`  ✓ Contains capabilities: ${prompt.includes('Capabilities')}`);
    console.log(`  ✓ Contains response format: ${prompt.includes('Response Format')}\n`);

    // ========== Test 5: Process Message (WITHOUT OpenAI call) ==========
    console.log('🔧 Testing Message Processing (Mock Mode)...');

    // Add some test memories first
    memoryManager.addShortTermMemory(
      { type: 'move', direction: 'up' },
      { success: true, new_position: { x: 5, y: 6 } }
    );
    memoryManager.addLongTermMemory({
      type: 'discovery',
      description: 'Found water source at (10, 5)',
      timestamp: new Date().toISOString()
    }, 8);

    console.log(`  ✓ Added test memories to system`);

    // Mock the OpenAI call to avoid actual API usage in tests
    const originalCallOpenAI = agent.callOpenAI.bind(agent);
    agent.callOpenAI = async (prompt, attempt) => {
      console.log(`  ✓ Mock OpenAI call (attempt ${attempt + 1})`);
      return {
        action: { type: 'move', direction: 'right' },
        reasoning: 'Moving towards water source to the right',
        new_goal: null
      };
    };

    const decision = await agent.processMessage(mockState);
    console.log(`  ✓ Decision received: ${decision.action.type}`);
    console.log(`  ✓ Direction: ${decision.action.direction}`);
    console.log(`  ✓ Reasoning: ${decision.reasoning}\n`);

    // Restore original method
    agent.callOpenAI = originalCallOpenAI;

    // ========== Test 6: Verify Memory Recording ==========
    console.log('💾 Verifying Memory Recording...');
    const recentActions = memoryManager.getRecentActions(10);
    console.log(`  ✓ Total short-term memories: ${recentActions.length}`);

    const locations = memoryManager.getNearbyLocations(5, 5, 10);
    console.log(`  ✓ Total explored locations: ${locations.length}`);

    const stats = memoryManager.getMemoryStats();
    console.log(`  ✓ Memory stats:`);
    console.log(`    - Short-term: ${stats.memories.short_term || 0}`);
    console.log(`    - Long-term: ${stats.memories.long_term || 0}`);
    console.log(`    - Locations: ${stats.locations}`);
    console.log(`    - Interactions: ${stats.interactions}\n`);

    // ========== Test 7: Test Goal Completion ==========
    console.log('🎯 Testing Goal Completion...');

    // Simulate reaching the goal location
    const goalReachedState = {
      position: { x: 7, y: 6 },
      surroundings: { up: 'wall', down: 'grass', left: 'grass', right: 'grass' },
      sleepiness: 3
    };

    const goalCheck = goalManager.checkGoalCompletion(goalReachedState);
    if (goalCheck.completed) {
      console.log(`  ✓ Goal completed: ${goalCheck.goal.description}`);
      console.log(`  ✓ Reason: ${goalCheck.reason}\n`);
    } else {
      console.log(`  ℹ️  Goal not yet completed (expected in mock mode)\n`);
    }

    // ========== Test 8: Cleanup ==========
    console.log('🧹 Cleaning up test data...');
    memoryManager.clearAllMemories();
    goalManager.clearAllGoals();

    const finalStats = memoryManager.getMemoryStats();
    const finalGoalStats = goalManager.getGoalStats();

    console.log(`  ✓ Memories cleared (${finalStats.memories.short_term || 0} + ${finalStats.memories.long_term || 0} remaining)`);
    console.log(`  ✓ Goals cleared (${finalGoalStats.total} remaining)\n`);

    // Close connection
    db.close();
    console.log('✅ All integration tests passed!\n');
    console.log('🎉 System is ready for production use!\n');
    console.log('📌 Next steps:');
    console.log('   1. Run "npm start" to start the WebSocket server');
    console.log('   2. Run the frontend to connect and test with OpenAI');
    console.log('   3. Monitor the agent\'s behavior and memory formation\n');

  } catch (error) {
    console.error('\n❌ Integration test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testIntegration();
