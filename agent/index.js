import { WebSocketServer } from 'ws';
import ServerAgent from './ServerAgent.js';
import DatabaseManager from './database.js';
import MemoryManager from './MemoryManager.js';
import GoalManager from './GoalManager.js';
import env from './env.json' assert { type: 'json' };

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

        // Create log callback to send AI logs to client
        const logCallback = (logData) => {
          ws.send(JSON.stringify({
            type: 'ai_log',
            data: logData
          }));
        };

        // Create the server agent with memory and goal capabilities
        agents[agentId] = new ServerAgent(agentId, memoryManager, goalManager, logCallback);

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
