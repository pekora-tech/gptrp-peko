# GPTRPG Ollama 整合實現狀態

## ✅ 已完成的文件創建

### 階段一：LLM Provider 抽象層
- ✅ `agent/providers/BaseLLMProvider.js` - 抽象基類
- ✅ `agent/providers/OpenAIProvider.js` - OpenAI 實現
- ✅ `agent/providers/OllamaProvider.js` - Ollama 實現
- ✅ `agent/providers/ProviderFactory.js` - Provider 工廠

### 階段二：配置系統
- ✅ `agent/config/AgentConfigSchema.js` - 配置 Schema + 驗證器 + 預設模板
- ✅ `agent/config/ConfigManager.js` - 配置管理器

### 測試與配置
- ✅ `agent/test-providers.js` - Provider 單元測試
- ✅ `agent/test-config.js` - 配置系統測試
- ✅ `agent/env.example.json` - 環境變量範例

### 階段六：前端配置面板
- ✅ `ui-admin/src/AgentConfigPanel.js` - React 配置面板組件
- ✅ `ui-admin/src/AgentConfigPanel.css` - 配置面板樣式

---

## 📝 下一步：整合到現有系統

### 階段三：ServerAgent 解耦

需要修改 `agent/ServerAgent.js`：

#### 1. 修改構造函數（第 6-20 行）

**原始**：
```javascript
constructor(id, memoryManager, goalManager, toolManager, behaviorExecutor, logCallback) {
  this.id = id;
  this.memoryManager = memoryManager;
  this.goalManager = goalManager;
  this.toolManager = toolManager;
  this.behaviorExecutor = behaviorExecutor;
  this.logCallback = logCallback;

  this.openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  this.model = env.OPENAI_MODEL || "gpt-5-mini";
}
```

**修改為**：
```javascript
constructor(id, memoryManager, goalManager, toolManager, behaviorExecutor, llmProvider, agentConfig, logCallback) {
  this.id = id;
  this.memoryManager = memoryManager;
  this.goalManager = goalManager;
  this.toolManager = toolManager;
  this.behaviorExecutor = behaviorExecutor;
  this.llmProvider = llmProvider;      // NEW
  this.agentConfig = agentConfig;      // NEW
  this.logCallback = logCallback;
}
```

#### 2. 修改 callOpenAI → callLLM（第 334-394 行）

**添加導入**：
```javascript
import extract from "extract-json-from-string";
```

**原始方法名**：`async callOpenAI(prompt, attempt)`

**修改為**：
```javascript
async callLLM(prompt, attempt = 0) {
  const maxRetries = this.agentConfig?.llmProvider?.maxRetries || 3;

  if (attempt >= maxRetries) {
    console.warn("⚠️  Max retry attempts reached");
    return { action: { type: "wait" }, reasoning: "Failed to get valid response" };
  }

  if (attempt > 0) {
    prompt = "YOU MUST ONLY RESPOND WITH VALID JSON OBJECTS\n\n" + prompt;
  }

  try {
    // 使用抽象的 Provider
    const response = await this.llmProvider.generateWithRetry(prompt, {
      jsonMode: true,
      temperature: this.agentConfig?.llmProvider?.temperature
    }, attempt);

    console.log(`🤖 LLM response (${response.provider}/${response.model}):`, response.content.substring(0, 100) + '...');

    // Log
    this.sendLog('response', {
      response: response.content,
      model: response.model,
      provider: response.provider,
      attempt: attempt + 1,
      usage: response.usage
    });

    // 清理和驗證 JSON
    const responseObject = this.cleanAndProcess(response.content);
    if (responseObject && responseObject.action) {
      return responseObject;
    }

    console.warn("⚠️  Invalid response structure, retrying...");
    return await this.callLLM(prompt, attempt + 1);

  } catch (error) {
    console.error(`❌ LLM API error (attempt ${attempt + 1}):`, error.message);
    return await this.callLLM(prompt, attempt + 1);
  }
}
```

#### 3. 修改 makeDecision（第 175-200 行）

**原始**：調用 `this.callOpenAI(prompt, 0)`

**修改為**：調用 `this.callLLM(prompt, 0)`

#### 4. 添加個性化 Prompt 方法

在 `buildEnhancedPrompt` 方法之後添加：

```javascript
/**
 * 建立性格特質描述
 */
buildTraitsDescription(personality) {
  if (!personality) return '';

  const { behaviorTendencies, traits, description } = personality;
  const descriptions = [];

  // 行為傾向描述
  if (behaviorTendencies) {
    if (behaviorTendencies.exploration > 70) {
      descriptions.push("You have a strong urge to explore unknown areas");
    } else if (behaviorTendencies.exploration < 30) {
      descriptions.push("You prefer staying in familiar territory");
    }

    if (behaviorTendencies.collection > 70) {
      descriptions.push("You love collecting and hoarding resources");
    }

    if (behaviorTendencies.social > 70) {
      descriptions.push("You seek out social interactions and companionship");
    }

    if (behaviorTendencies.defensive > 70) {
      descriptions.push("You prioritize safety and defensive strategies");
    }
  }

  // 性格特質描述
  if (traits) {
    if (traits.cautious > 70) {
      descriptions.push("You are extremely cautious and risk-averse");
    } else if (traits.bold > 70) {
      descriptions.push("You are bold and enjoy taking calculated risks");
    }

    if (traits.curious > 70) {
      descriptions.push("You have an insatiable curiosity about the world");
    }

    if (traits.lazy > 70) {
      descriptions.push("You prefer efficiency and minimal effort solutions");
    }
  }

  // 自定義描述
  if (description) {
    descriptions.push(description);
  }

  return descriptions.join('. ');
}
```

#### 5. 修改 buildEnhancedPrompt（第 207-326 行）

在方法開頭添加個性化部分：

```javascript
buildEnhancedPrompt({ currentState, recentActions, importantMemories, nearbyLocations, recentInteractions, currentGoal, suggestedTool }) {
  const personality = this.agentConfig?.personality;

  // === 新增：個性化介紹部分 ===
  let personalitySection = '';
  if (personality) {
    const traits = this.buildTraitsDescription(personality);
    if (traits) {
      personalitySection = `
## Your Personality

${traits}

This personality influences how you interpret situations and make decisions.
`;
    }
  }

  // === 繼續原有的 Prompt 構建 ===
  let toolSection = '';
  if (suggestedTool && suggestedTool.confidence > 0.8) {
    toolSection = `
## Suggested Tool
...
`;
  }

  // ... 其餘部分保持不變，只需在適當位置插入 ${personalitySection}
}
```

---

### 階段四：後端整合

需要修改 `agent/index.js`：

#### 1. 添加導入（第 1-15 行）

```javascript
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
```

#### 2. 初始化 ConfigManager（第 13-16 行之後）

```javascript
console.log('📦 Initializing database...');
const db = new DatabaseManager(env.DATABASE_PATH || './agent_memory.db');
console.log('✓ Database initialized');

// === 新增 ===
console.log('📦 Initializing config manager...');
const configManager = new ConfigManager(db);
console.log('✓ Config manager initialized\n');
```

#### 3. 重寫 create_agent 消息處理（第 35-107 行）

**完整替換**為：

```javascript
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
```

#### 4. 添加 update_agent_config 消息處理

在 `recordInteraction` 之後添加：

```javascript
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
```

---

### 階段五：前端基礎改造

#### 1. 修改 `ui-admin/src/Agent.js`

**構造函數修改**（第 2-28 行）：

```javascript
constructor(gridEngine, fieldMapTileMap, agent_id, agentConfig, onAILog = null) {
  this.gridEngine = gridEngine;
  this.fieldMapTileMap = fieldMapTileMap;
  this.agent_id = agent_id;

  // === 改造點：接受完整配置 ===
  this.agentConfig = agentConfig;
  this.bedPosition = agentConfig.initialState?.bedPosition || { x: 3, y: 3 };

  this.sleepiness = 0;
  this.onAILog = onAILog;

  const socket = new WebSocket('ws://localhost:8080');
  this.socket = socket;

  this.socket.addEventListener('open', () => {
    // === 改造點：發送配置到後端 ===
    this.socket.send(JSON.stringify({
      type: 'create_agent',
      agent_id: agent_id,
      config: agentConfig  // 傳送完整配置
    }));

    setTimeout(() => {
      this.socket.send(JSON.stringify({
        type: 'record_bed_location',
        agent_id: agent_id,
        bed_location: this.bedPosition
      }));
    }, 1000);
  });

  this.initializeServerListener();
  this.initializeMovementStoppedListener();
}
```

#### 2. 修改 `ui-admin/src/App.js`

**導入和整合 AgentConfigPanel**：

```javascript
import React, { useState, useEffect } from 'react';
import Game from './Game';
import AIConsole from './AIConsole';
import TaskManager from './TaskManager';
import AgentConfigPanel from './AgentConfigPanel';  // 新增
import './App.css';

function App() {
  const [aiLogs, setAiLogs] = useState([]);
  const [tasks, setTasks] = useState([]);

  // 新增：處理動態創建 Agent
  const handleCreateAgent = (config) => {
    console.log('Creating agent with config:', config);
    // TODO: 實現動態添加 Agent 到場景
    // 可以通過 window.__GRID_ENGINE__ 和 window.__AGENTS__ 訪問
    alert(`Agent ${config.agentId} created! Refresh the page to see it.`);
  };

  useEffect(() => {
    window.__AI_LOG_CALLBACK__ = (log) => {
      setAiLogs(prev => [...prev, log]);
    };

    window.__TASK_UPDATE_CALLBACK__ = (task) => {
      setTasks(prev => [...prev, task]);
    };

    return () => {
      delete window.__AI_LOG_CALLBACK__;
      delete window.__TASK_UPDATE_CALLBACK__;
    };
  }, []);

  return (
    <>
      <div id="game"></div>
      <AIConsole logs={aiLogs} />
      <TaskManager tasks={tasks} onDeleteTask={(index) => {
        setTasks(prev => prev.filter((_, i) => i !== index));
      }} />
      <AgentConfigPanel onCreateAgent={handleCreateAgent} />  {/* 新增 */}
    </>
  );
}

export default App;
```

---

## 🧪 測試步驟

### 1. 測試 Provider 層

```bash
cd agent
node test-providers.js
```

**預期輸出**：
- ✅ OpenAI Provider 創建成功
- ✅ Ollama Provider 創建成功
- ✅ JSON 模式測試通過

### 2. 測試配置系統

```bash
node test-config.js
```

**預期輸出**：
- ✅ 配置驗證測試通過
- ✅ 默認值應用測試通過
- ✅ ConfigManager CRUD 測試通過

### 3. 整合測試

完成階段三、四、五的修改後：

```bash
# 啟動後端
cd agent
npm start

# 啟動前端
cd ui-admin
npm start
```

**測試場景**：
1. 打開配置面板
2. 選擇 "Explorer" 模板
3. 填寫 Agent ID
4. 選擇 OpenAI 或 Ollama
5. 點擊 "Create Agent"
6. 檢查控制台日誌

---

## 📊 進度總結

| 階段 | 狀態 | 文件數 | 下一步 |
|------|------|--------|--------|
| 階段一：Provider 抽象層 | ✅ 完成 | 4 | 測試 |
| 階段二：配置系統 | ✅ 完成 | 2 | 測試 |
| 階段三：ServerAgent 解耦 | 📝 待整合 | 1 | 修改 ServerAgent.js |
| 階段四：後端整合 | 📝 待整合 | 1 | 修改 index.js |
| 階段五：前端改造 | 📝 待整合 | 2 | 修改 Agent.js, App.js |
| 階段六：配置面板 | ✅ 完成 | 2 | 整合到 App.js |

**總計**：
- ✅ 已創建：12 個文件
- 📝 待修改：4 個文件（ServerAgent.js, index.js, Agent.js, App.js）

---

## 🎯 立即可執行的測試

即使尚未整合到主系統，您現在可以：

1. **測試 Provider**：
   ```bash
   cd agent
   node test-providers.js
   ```

2. **測試配置系統**：
   ```bash
   node test-config.js
   ```

3. **手動測試 Provider**：
   ```javascript
   // 在 Node.js REPL 中
   const ProviderFactory = await import('./providers/ProviderFactory.js');
   const env = await import('./env.json', { assert: { type: 'json' } });

   const provider = ProviderFactory.default.createProvider({
     type: 'ollama',
     model: 'gemma3:12b'
   });

   const health = await provider.healthCheck();
   console.log(health);

   const response = await provider.generateWithRetry(
     'Return JSON: {"greeting": "Hello!"}',
     { jsonMode: true }
   );
   console.log(response);
   ```

---

## 📚 相關文檔

- 完整實現計劃：`C:\Users\yn210\.claude\plans\logical-foraging-lake.md`
- 原始設計文檔：`docs/rosy-tinkering-giraffe.md`
- Provider 測試：`agent/test-providers.js`
- 配置測試：`agent/test-config.js`

---

**準備好繼續整合到主系統了嗎？請告訴我從哪個階段開始！**
