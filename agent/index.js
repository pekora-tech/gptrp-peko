import { WebSocketServer } from 'ws';
import ServerAgent from './ServerAgent.js';
import DatabaseManager from './database.js';
import MemoryManager from './MemoryManager.js';
import GoalManager from './GoalManager.js';
import ToolManager from './ToolManager.js';
import BehaviorExecutor from './BehaviorExecutor.js';
import env from './env.json' assert { type: 'json' };
import presetTools from './tools/presets.json' assert { type: 'json' };

console.log('🚀 Starting GPTRPG Agent Server...\n');

// Initialize database (shared across all agents)
console.log('📦 Initializing database...');
const db = new DatabaseManager(env.DATABASE_PATH || './agent_memory.db');
console.log('✓ Database initialized\n');

// WebSocket server
const wss = new WebSocketServer({ port: 8080 });

// Store agents
const agents = {};

wss.on('connection', function connection(ws) {
  console.log('🔌 New client connected');

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });

  ws.on('message', async function message(data) {
    try {
      const parsedData = JSON.parse(data);

      if (parsedData.type === 'create_agent') {
        const agentId = parsedData.agent_id;
        console.log(`\n🤖 Creating Agent: ${agentId}`);

        // Check if agent already exists
        if (agents[agentId]) {
          ws.send(JSON.stringify({
            type: 'agent_created',
            success: false,
            message: `Agent with id ${agentId} already exists`
          }));
          return;
        }

        // Create memory and goal managers for this agent
        const memoryManager = new MemoryManager(db, agentId);
        const goalManager = new GoalManager(db, agentId);
        const toolManager = new ToolManager(db, agentId);
        const behaviorExecutor = new BehaviorExecutor(db, agentId, toolManager, memoryManager);

        // Load preset tools (only on first creation)
        const existingTools = db.all('SELECT id FROM tools WHERE agent_id = ?', [agentId]);
        if (existingTools.length === 0) {
          console.log(`📦 Loading preset tools for agent ${agentId}...`);
          toolManager.loadPresetTools(presetTools);
        }

        // Create log callback to send AI logs and task updates to client
        const logCallback = (logData) => {
          // If it's a task update, send it as a separate type
          if (logData.type === 'task_update') {
            ws.send(JSON.stringify({
              type: 'task_update',
              data: logData
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'ai_log',
              data: logData
            }));
          }
        };

        // Create the server agent with all capabilities
        agents[agentId] = new ServerAgent(
          agentId,
          memoryManager,
          goalManager,
          toolManager,
          behaviorExecutor,
          logCallback
        );

        console.log(`✓ Agent ${agentId} created with memory and goal systems`);

        // Create initial goal if none exists
        const existingGoal = await goalManager.getCurrentGoal();
        if (!existingGoal) {
          await goalManager.createGoal(
            'Explore the world and understand my surroundings',
            'exploration',
            5
          );
          console.log(`🎯 Set initial exploration goal for agent ${agentId}`);
        }

        ws.send(JSON.stringify({
          type: 'agent_created',
          success: true,
          agent_id: agentId,
          message: `Agent with id ${agentId} created with memory and goal systems`
        }));
      }

      else if (parsedData.type === 'requestNextMove') {
        const agentId = parsedData.agent_id;
        console.log(`\n🎮 Processing move request for agent: ${agentId}`);

        if (agents[agentId]) {
          try {
            const decision = await agents[agentId].processMessage(parsedData);

            console.log(`📤 Sending decision to client:`, decision);

            ws.send(JSON.stringify({
              type: 'nextMove',
              agent_id: agentId,
              data: decision
            }));
          } catch (error) {
            console.error(`❌ Error processing move for agent ${agentId}:`, error);
            ws.send(JSON.stringify({
              type: 'nextMove',
              agent_id: agentId,
              data: {
                action: { type: 'wait' },
                reasoning: 'Error occurred during decision making'
              }
            }));
          }
        } else {
          console.warn(`⚠️  Agent ${agentId} not found`);
          ws.send(JSON.stringify({
            type: 'error',
            message: `Agent with id ${agentId} not found`
          }));
        }
      }

      else if (parsedData.type === 'record_bed_location') {
        // Record bed location to memory
        const agentId = parsedData.agent_id;
        const bedLocation = parsedData.bed_location;

        if (agents[agentId] && bedLocation) {
          const agent = agents[agentId];
          await agent.memoryManager.recordLocation(
            bedLocation.x,
            bedLocation.y,
            'bed',
            { resource: 'bed', type: 'sleep_location' }
          );
          console.log(`🛏️  Recorded bed location: (${bedLocation.x}, ${bedLocation.y}) for agent ${agentId}`);
        }
      }

      else if (parsedData.type === 'recordInteraction') {
        // Optional: Handle interaction recording from client
        const agentId = parsedData.agent_id;
        const interaction = parsedData.interaction;

        if (agents[agentId] && interaction) {
          const agent = agents[agentId];
          await agent.memoryManager.recordInteraction(
            interaction.type,
            interaction.location.x,
            interaction.location.y,
            interaction.result
          );
          console.log(`📝 Recorded interaction: ${interaction.type} at (${interaction.location.x}, ${interaction.location.y})`);
        }
      }

      else {
        console.warn(`⚠️  Unknown message type: ${parsedData.type}`);
      }

    } catch (error) {
      console.error('❌ Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message: ' + error.message
      }));
    }
  });

  ws.on('close', () => {
    console.log('🔌 Client disconnected');
  });
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');

  // Close database connection
  db.close();
  console.log('✓ Database connection closed');

  // Close WebSocket server
  wss.close(() => {
    console.log('✓ WebSocket server closed');
    process.exit(0);
  });
});

console.log('✅ WebSocket server listening on port 8080');
console.log(`📊 Configuration:`);
console.log(`   - OpenAI Model: ${env.OPENAI_MODEL}`);
console.log(`   - Database Path: ${env.DATABASE_PATH}`);
console.log(`   - Short-term Memory Size: ${env.MEMORY_SHORT_TERM_SIZE}`);
console.log(`   - Long-term Memory Threshold: ${env.MEMORY_LONG_TERM_THRESHOLD}`);
console.log(`   - Location Memory Radius: ${env.MEMORY_LOCATION_RADIUS}`);
console.log('\n🎮 Waiting for agent connections...\n');
