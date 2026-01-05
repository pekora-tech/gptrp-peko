import { WebSocketServer } from 'ws';
import ServerAgent from './ServerAgent.js';
import DatabaseManager from './database.js';
import MemoryManager from './MemoryManager.js';
import GoalManager from './GoalManager.js';
import ToolManager from './ToolManager.js';
import BehaviorExecutor from './BehaviorExecutor.js';

// === 新增導入 ===
import ProviderFactory from './providers/ProviderFactory.js';
import ConfigManager from './config/ConfigManager.js';
import { AgentConfigValidator } from './config/AgentConfigSchema.js';

import env from './env.json' assert { type: 'json' };
import presetTools from './tools/presets.json' assert { type: 'json' };

console.log('🚀 Starting GPTRPG Agent Server...\n');

// Initialize database (shared across all agents)
console.log('📦 Initializing database...');
const db = new DatabaseManager(env.DATABASE_PATH || './agent_memory.db');
console.log('✓ Database initialized');

// === 新增：初始化 ConfigManager ===
console.log('📦 Initializing config manager...');
const configManager = new ConfigManager(db);
console.log('✓ Config manager initialized\n');

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
        const agentConfig = parsedData.config || {};

        console.log(`\n🤖 Creating Agent: ${agentId}`);

        if (agents[agentId]) {
          ws.send(JSON.stringify({
            type: 'agent_created',
            success: false,
            message: `Agent ${agentId} already exists`
          }));
          return;
        }

        try {
          // 1. 填充 agentId
          agentConfig.agentId = agentId;

          // 2. 如果沒有提供 LLM Provider 配置，使用默認配置（向後兼容）
          if (!agentConfig.llmProvider) {
            console.log(`  Using default provider from env.json...`);
            const defaultProvider = ProviderFactory.createDefaultProvider(env);
            agentConfig.llmProvider = defaultProvider.getMetadata();
            // 添加 apiKey（如果是 OpenAI）
            if (agentConfig.llmProvider.type === 'openai' && env.OPENAI_API_KEY) {
              agentConfig.llmProvider.apiKey = env.OPENAI_API_KEY;
            }
          }

          // 3. 驗證配置
          const validation = AgentConfigValidator.validate(agentConfig);
          if (!validation.valid) {
            throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
          }

          // 4. 應用默認值
          const fullConfig = AgentConfigValidator.applyDefaults(agentConfig);

          // 5. 創建 LLM Provider
          console.log(`  Creating ${fullConfig.llmProvider.type} provider...`);
          const llmProvider = ProviderFactory.createProvider(fullConfig.llmProvider);

          // 6. 健康檢查
          console.log(`  Performing health check...`);
          const health = await llmProvider.healthCheck();
          if (!health.healthy) {
            throw new Error(`Provider health check failed: ${health.message}`);
          }
          console.log(`  ✓ Provider is healthy: ${health.message}`);

          // 7. 保存配置
          configManager.saveConfig(agentId, fullConfig);

          // 8. 創建 Managers（保持不變）
          const memoryManager = new MemoryManager(db, agentId);
          const goalManager = new GoalManager(db, agentId);
          const toolManager = new ToolManager(db, agentId);
          const behaviorExecutor = new BehaviorExecutor(db, agentId, toolManager, memoryManager);

          // 9. 加載預設工具
          const existingTools = db.all('SELECT id FROM tools WHERE agent_id = ?', [agentId]);
          if (existingTools.length === 0) {
            console.log(`  Loading preset tools...`);
            toolManager.loadPresetTools(presetTools);
          }

          // 10. 創建 Log Callback
          const logCallback = (logData) => {
            if (logData.type === 'task_update') {
              ws.send(JSON.stringify({ type: 'task_update', data: logData }));
            } else {
              ws.send(JSON.stringify({ type: 'ai_log', data: logData }));
            }
          };

          // 11. 創建 ServerAgent（NEW: 傳入 llmProvider 和 fullConfig）
          agents[agentId] = new ServerAgent(
            agentId,
            memoryManager,
            goalManager,
            toolManager,
            behaviorExecutor,
            llmProvider,      // NEW
            fullConfig,       // NEW
            logCallback
          );

          console.log(`✓ Agent ${agentId} created successfully`);
          console.log(`  Provider: ${fullConfig.llmProvider.type} (${fullConfig.llmProvider.model})`);

          // 12. 創建初始目標
          const existingGoal = await goalManager.getCurrentGoal();
          if (!existingGoal) {
            await goalManager.createGoal(
              'Explore the world and understand my surroundings',
              'exploration',
              5
            );
          }

          // 13. 響應成功
          ws.send(JSON.stringify({
            type: 'agent_created',
            success: true,
            agent_id: agentId,
            config: fullConfig,
            message: `Agent ${agentId} created with ${fullConfig.llmProvider.type} provider`
          }));

        } catch (error) {
          console.error(`❌ Failed to create agent ${agentId}:`, error.message);
          ws.send(JSON.stringify({
            type: 'agent_created',
            success: false,
            agent_id: agentId,
            message: error.message
          }));
        }
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

      else if (parsedData.type === 'sleep_completed') {
        // Handle sleep completion notification
        const agentId = parsedData.agent_id;
        console.log(`😴 Agent ${agentId} completed sleep at (${parsedData.position.x}, ${parsedData.position.y})`);

        // 發送任務完成事件
        if (agents[agentId]) {
          agents[agentId].sendLog('task_update', {
            description: `Successfully completed goto_bed: slept and rested`,
            status: 'completed',
            toolName: 'goto_bed',
            createdAt: new Date().toISOString()
          });
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

      else if (parsedData.type === 'update_agent_config') {
        const agentId = parsedData.agent_id;
        const updates = parsedData.updates;

        console.log(`\n🔧 Updating config for agent: ${agentId}`);

        if (!agents[agentId]) {
          ws.send(JSON.stringify({
            type: 'config_updated',
            success: false,
            message: `Agent ${agentId} not found`
          }));
          return;
        }

        try {
          const updatedConfig = configManager.updateConfig(agentId, updates);

          if (updates.llmProvider) {
            console.log(`  Recreating LLM provider...`);
            const newProvider = ProviderFactory.createProvider(updatedConfig.llmProvider);

            const health = await newProvider.healthCheck();
            if (!health.healthy) {
              throw new Error(`New provider health check failed: ${health.message}`);
            }

            agents[agentId].llmProvider = newProvider;
            agents[agentId].agentConfig = updatedConfig;

            console.log(`  ✓ Provider updated to ${updatedConfig.llmProvider.type}`);
          } else {
            agents[agentId].agentConfig = updatedConfig;
            console.log(`  ✓ Config updated (provider unchanged)`);
          }

          ws.send(JSON.stringify({
            type: 'config_updated',
            success: true,
            agent_id: agentId,
            config: updatedConfig
          }));

        } catch (error) {
          console.error(`❌ Failed to update config:`, error.message);
          ws.send(JSON.stringify({
            type: 'config_updated',
            success: false,
            message: error.message
          }));
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
