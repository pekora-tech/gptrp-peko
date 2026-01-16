# GPTRPG Ollama 整合與多 Agent 個性化系統 - 實現計劃

## 📋 概述

基於現有的 GPTRPG 專案，實現 Ollama 整合的進階優化方案，支援：
- **每個 Agent 獨立配置** LLM 提供者（OpenAI 或 Ollama）
- **嚴格 JSON 模式** + 多次重試機制
- **多個獨立 Agent 同時運行**
- **個性化配置**：行為傾向、性格特質、記憶容量、工具偏好

## 🎯 核心架構設計

### LLM Provider 抽象層

```
BaseLLMProvider (抽象基類)
    ├── OpenAIProvider (使用 OpenAI SDK)
    └── OllamaProvider (使用 Ollama API)

ProviderFactory (工廠模式)
    └── createProvider(config) → Provider 實例
```

### Agent 配置系統

每個 Agent 擁有完整的配置 Schema：
```json
{
  "agentId": "explorer_1",
  "llmProvider": {
    "type": "openai|ollama",
    "model": "gpt-5-mini | gemma3:12b",
    "temperature": 0.7
  },
  "personality": {
    "behaviorTendencies": {
      "exploration": 90,
      "collection": 40,
      "social": 30,
      "defensive": 20
    },
    "traits": {
      "cautious": 20,
      "bold": 85,
      "curious": 90,
      "lazy": 10
    }
  },
  "memory": {
    "shortTermSize": 25,
    "longTermThreshold": 6
  },
  "toolPreferences": {
    "allowedTools": [],
    "blockedTools": []
  }
}
```

## 📂 文件結構

### 新增文件

#### 後端核心
- `agent/providers/BaseLLMProvider.js` - Provider 基類接口（50 行）
- `agent/providers/OpenAIProvider.js` - OpenAI 實現（120 行）
- `agent/providers/OllamaProvider.js` - Ollama 實現（150 行）
- `agent/providers/ProviderFactory.js` - Provider 工廠（80 行）

#### 配置系統
- `agent/config/AgentConfigSchema.js` - 配置 Schema + 驗證器（300 行）
- `agent/config/ConfigManager.js` - 配置管理器（120 行）

#### 測試文件
- `agent/test-providers.js` - Provider 單元測試（100 行）
- `agent/test-config.js` - 配置系統測試（80 行）

#### 前端組件
- `ui-admin/src/AgentConfigPanel.js` - 配置面板組件（250 行）
- `ui-admin/src/AgentConfigPanel.css` - 配置面板樣式（150 行）

#### 配置範例
- `agent/env.example.json` - 環境變量範例（30 行）

### 修改文件

#### 後端（關鍵修改）
1. **[agent/ServerAgent.js](g:\PD_DEV\gptrp-peko\agent\ServerAgent.js)**
   - 構造函數：添加 `llmProvider` 和 `agentConfig` 參數
   - `callOpenAI` → `callLLM`：解耦 OpenAI 依賴
   - `buildEnhancedPrompt`：注入個性化描述

2. **[agent/index.js](g:\PD_DEV\gptrp-peko\agent\index.js)**
   - `create_agent`：支援接收和驗證配置
   - 新增 `update_agent_config` 消息處理
   - 初始化 ConfigManager

3. **[agent/database.js](g:\PD_DEV\gptrp-peko\agent\database.js)**
   - 添加 `agent_configs` 表

#### 前端（關鍵修改）
4. **[ui-admin/src/Agent.js](g:\PD_DEV\gptrp-peko\ui-admin\src\Agent.js)**
   - 構造函數：接受完整 `agentConfig` 而非簡單的 `bedPosition`
   - WebSocket：發送配置到後端

5. **[ui-admin/src/create.js](g:\PD_DEV\gptrp-peko\ui-admin\src\create.js)**
   - 重寫為支援多 Agent 配置數組
   - 動態創建多個 Sprite 和 Agent 實例
   - 相機控制：`C` 鍵切換模式，`1/2/3` 鍵切換跟隨

6. **[ui-admin/src/AIConsole.js](g:\PD_DEV\gptrp-peko\ui-admin\src\AIConsole.js)**
   - 添加 Agent 過濾下拉選單

7. **[ui-admin/src/TaskManager.js](g:\PD_DEV\gptrp-peko\ui-admin\src\TaskManager.js)**
   - 顯示 Agent 標籤

8. **[ui-admin/src/App.js](g:\PD_DEV\gptrp-peko\ui-admin\src\App.js)**
   - 整合 AgentConfigPanel 組件

## 🔧 實現階段

### 階段一：LLM Provider 抽象層（2-3 小時）

**目標**：創建可擴展的 Provider 系統

#### 文件實現順序
1. `agent/providers/BaseLLMProvider.js`
   - 定義抽象接口：`generate()`, `healthCheck()`, `validateConfig()`

2. `agent/providers/OpenAIProvider.js`
   - 封裝現有 OpenAI 代碼
   - 使用 `response_format: { type: "json_object" }`
   - 處理 gpt-5-mini 不支援 temperature 的特殊情況

3. `agent/providers/OllamaProvider.js`
   - 實現 HTTP REST API 調用 (`/api/generate`)
   - JSON 模式：`format: 'json'` + Prompt 強調
   - 多層防護：重試 + extract-json-from-string 回退

4. `agent/providers/ProviderFactory.js`
   - `createProvider(config)` 方法
   - 配置驗證
   - 向後兼容（從 env.json 讀取）

#### 驗收標準
- [ ] OpenAI Provider 通過 health check
- [ ] Ollama Provider 通過 health check
- [ ] JSON 模式穩定返回可解析的 JSON
- [ ] 錯誤處理正常工作

---

### 階段二：配置系統（2-3 小時）

**目標**：實現 Agent 配置的驗證、存儲和讀取

#### 文件實現順序
1. `agent/config/AgentConfigSchema.js`
   - 定義完整的配置 Schema
   - 實現 `AgentConfigValidator.validate()`
   - 實現 `AgentConfigValidator.applyDefaults()`
   - 數值範圍驗證（0-100, 0-2 等）

2. `agent/config/ConfigManager.js`
   - 構造函數：初始化數據庫表
   - `saveConfig(agentId, config)` - UPSERT 操作
   - `getConfig(agentId)` - 讀取配置
   - `updateConfig(agentId, partialConfig)` - 部分更新

3. 修改 `agent/database.js`
   - 添加表初始化：
     ```sql
     CREATE TABLE agent_configs (
       agent_id TEXT PRIMARY KEY,
       config TEXT NOT NULL,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
       updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
     );
     ```

#### 驗收標準
- [ ] 配置驗證正確拒絕無效配置
- [ ] 默認值正確填充
- [ ] 數據庫存儲和讀取正常
- [ ] 部分更新不覆蓋其他字段

---

### 階段三：ServerAgent 解耦（1-2 小時）

**目標**：移除 ServerAgent 對 OpenAI 的直接依賴

#### 修改 [agent/ServerAgent.js](g:\PD_DEV\gptrp-peko\agent\ServerAgent.js)

1. **構造函數變更**（第 6-20 行）
   ```javascript
   constructor(id, memoryManager, goalManager, toolManager,
               behaviorExecutor, llmProvider, agentConfig, logCallback) {
     // 新增: llmProvider 和 agentConfig 參數
   }
   ```

2. **callOpenAI → callLLM**（第 334-394 行）
   - 移除直接 OpenAI 調用
   - 使用 `this.llmProvider.generate()`
   - 統一錯誤處理和重試邏輯

3. **buildEnhancedPrompt 個性化注入**（第 207-326 行）
   - 添加 `buildTraitsDescription()` 方法
   - 在 Prompt 中插入個性化部分
   - 根據 toolPreferences 過濾工具

#### 關鍵代碼片段

**個性化 Prompt 注入**：
```javascript
buildEnhancedPrompt(context) {
  const personality = this.agentConfig.personality;

  let personalitySection = '';
  if (personality) {
    const traits = this.buildTraitsDescription(personality);
    personalitySection = `
## Your Personality

${traits}

This personality influences how you interpret situations and make decisions.
`;
  }

  // 組合完整 Prompt...
}

buildTraitsDescription(personality) {
  const { behaviorTendencies, traits } = personality;
  const descriptions = [];

  if (behaviorTendencies?.exploration > 70) {
    descriptions.push("You have a strong urge to explore unknown areas");
  }
  if (traits?.cautious > 70) {
    descriptions.push("You are extremely cautious and risk-averse");
  }
  // ... 更多條件

  return descriptions.join('. ') + '.';
}
```

#### 驗收標準
- [ ] 使用 OpenAI Provider 的 Agent 正常工作
- [ ] 使用 Ollama Provider 的 Agent 正常工作
- [ ] Prompt 包含個性化描述
- [ ] LLM 調用日誌包含 Provider 信息

---

### 階段四：後端整合（2 小時）

**目標**：修改 index.js 支援配置驅動的 Agent 創建

#### 修改 [agent/index.js](g:\PD_DEV\gptrp-peko\agent\index.js)

1. **導入新模組**（第 1-15 行）
   ```javascript
   import ProviderFactory from './providers/ProviderFactory.js';
   import ConfigManager from './config/ConfigManager.js';
   import { AgentConfigValidator } from './config/AgentConfigSchema.js';
   ```

2. **初始化 ConfigManager**（第 13-16 行之後）
   ```javascript
   const configManager = new ConfigManager(db);
   ```

3. **重寫 create_agent 消息處理**（第 35-107 行）
   - 接收 `parsedData.config`
   - 驗證配置：`AgentConfigValidator.validate()`
   - 創建 Provider：`ProviderFactory.createProvider()`
   - 健康檢查：`provider.healthCheck()`
   - 保存配置：`configManager.saveConfig()`
   - 傳入 Provider 和 Config 到 ServerAgent

4. **新增 update_agent_config 消息處理**
   ```javascript
   else if (parsedData.type === 'update_agent_config') {
     const updatedConfig = configManager.updateConfig(agentId, updates);

     if (updates.llmProvider) {
       const newProvider = ProviderFactory.createProvider(updatedConfig.llmProvider);
       agents[agentId].llmProvider = newProvider;
     }

     agents[agentId].agentConfig = updatedConfig;
   }
   ```

#### 向後兼容處理
```javascript
// 如果沒有提供 llmProvider 配置，使用默認配置
if (!agentConfig.llmProvider) {
  const defaultProvider = ProviderFactory.createDefaultProvider(env);
  agentConfig.llmProvider = defaultProvider.getMetadata();
}
```

#### 驗收標準
- [ ] 可以創建 OpenAI Agent
- [ ] 可以創建 Ollama Agent
- [ ] 無效配置被正確拒絕
- [ ] 配置更新正常工作
- [ ] 日誌清晰顯示 Provider 類型

---

### 階段五：前端基礎改造（2-3 小時）

**目標**：Agent.js 和 create.js 支援配置傳入

#### 5.1 修改 [ui-admin/src/Agent.js](g:\PD_DEV\gptrp-peko\ui-admin\src\Agent.js)

1. **構造函數變更**（第 2-28 行）
   ```javascript
   constructor(gridEngine, fieldMapTileMap, agent_id, agentConfig, onAILog = null) {
     this.agentConfig = agentConfig;
     this.bedPosition = agentConfig.initialState?.bedPosition || { x: 3, y: 3 };

     // WebSocket 發送配置
     this.socket.send(JSON.stringify({
       type: 'create_agent',
       agent_id: agent_id,
       config: agentConfig
     }));
   }
   ```

2. **向後兼容處理**
   ```javascript
   // 檢測是否為舊格式（直接傳入 bedPosition）
   if (configOrBedPosition?.x !== undefined) {
     // 舊格式轉換
     this.agentConfig = {
       agentId: agent_id,
       initialState: { bedPosition: configOrBedPosition }
     };
   }
   ```

#### 5.2 重寫 [ui-admin/src/create.js](g:\PD_DEV\gptrp-peko\ui-admin\src\create.js)

**完全重寫為多 Agent 支援**：

1. **定義 Agent 配置數組**
   ```javascript
   const AGENT_CONFIGS = [
     {
       agentId: "explorer_openai",
       name: "Explorer (OpenAI)",
       llmProvider: {
         type: "openai",
         apiKey: process.env.REACT_APP_OPENAI_API_KEY,
         model: "gpt-5-mini"
       },
       personality: {
         behaviorTendencies: { exploration: 90 },
         traits: { bold: 85, curious: 90 }
       },
       initialState: {
         position: { x: 7, y: 6 },
         bedPosition: { x: 6, y: 5 }
       }
     },
     {
       agentId: "collector_ollama",
       name: "Collector (Ollama)",
       llmProvider: {
         type: "ollama",
         model: "gemma3:12b"
       },
       personality: {
         behaviorTendencies: { collection: 95 },
         traits: { cautious: 80 }
       },
       initialState: {
         position: { x: 10, y: 8 },
         bedPosition: { x: 6, y: 5 }
       }
     }
   ];
   ```

2. **動態創建多個 Agent**
   ```javascript
   const characters = [];
   const agents = [];

   AGENT_CONFIGS.forEach((config) => {
     const sprite = this.add.sprite(0, 0, config.initialState.spriteKey || 'player');

     characters.push({
       id: config.agentId,
       sprite: sprite,
       startPosition: config.initialState.position
     });

     const agent = new Agent(
       this.gridEngine,
       this.fieldMapTileMap,
       config.agentId,
       config,
       onAILog
     );

     agents.push({ config, agent, sprite });
   });

   this.gridEngine.create(this.fieldMapTileMap, { characters });
   ```

3. **相機控制增強**
   - `C` 鍵：切換自由/跟隨模式
   - `1/2/3` 鍵：切換跟隨不同 Agent

#### 5.3 修改 [ui-admin/src/AIConsole.js](g:\PD_DEV\gptrp-peko\ui-admin\src\AIConsole.js)

**添加 Agent 過濾**：
```javascript
const [selectedAgent, setSelectedAgent] = useState('all');
const agentIds = [...new Set(logs.map(log => log.agentId))];
const filteredLogs = selectedAgent === 'all'
  ? logs
  : logs.filter(log => log.agentId === selectedAgent);

// 下拉選單
<select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}>
  <option value="all">All Agents</option>
  {agentIds.map(id => <option key={id} value={id}>{id}</option>)}
</select>
```

#### 驗收標準
- [ ] 單個 Agent 正常工作
- [ ] 多個 Agent 可同時運行
- [ ] AI Console 能按 Agent 過濾日誌
- [ ] Task Manager 顯示 Agent 標籤
- [ ] 相機可切換跟隨不同 Agent

---

### 階段六：Agent 配置面板（3-4 小時）【可選】

**目標**：提供 UI 界面動態創建 Agent

#### 新增文件

1. **[ui-admin/src/AgentConfigPanel.js](g:\PD_DEV\gptrp-peko\ui-admin\src\AgentConfigPanel.js)**（250 行）
   - 表單組件：基本信息、LLM Provider、個性化、記憶設置
   - 滑塊控制：0-100 範圍的個性化參數
   - 動態切換：OpenAI/Ollama 不同字段
   - 驗證和提交

2. **[ui-admin/src/AgentConfigPanel.css](g:\PD_DEV\gptrp-peko\ui-admin\src\AgentConfigPanel.css)**（150 行）
   - 面板樣式
   - 表單佈局
   - 滑塊樣式

#### 整合到 App.js

```javascript
import AgentConfigPanel from './AgentConfigPanel';

function App() {
  const handleCreateAgent = (config) => {
    // TODO: 實現動態創建 Agent
    console.log('Creating agent with config:', config);
  };

  return (
    <>
      <div id="game"></div>
      <AIConsole logs={aiLogs} />
      <TaskManager />
      <AgentConfigPanel onCreateAgent={handleCreateAgent} />
    </>
  );
}
```

#### 驗收標準
- [ ] 可以通過 UI 創建 OpenAI Agent
- [ ] 可以通過 UI 創建 Ollama Agent
- [ ] 滑塊正確反映數值
- [ ] 表單驗證正常工作

---

## 🧪 測試策略

### 單元測試

#### test-providers.js
```javascript
async function testOpenAI() {
  const provider = ProviderFactory.createProvider({
    type: 'openai',
    apiKey: 'sk-...',
    model: 'gpt-5-mini'
  });

  const health = await provider.healthCheck();
  console.assert(health.healthy, 'OpenAI should be healthy');

  const response = await provider.generate('Return JSON: {"test": true}', { jsonMode: true });
  console.assert(JSON.parse(response.content), 'Should return valid JSON');
}

async function testOllama() {
  const provider = ProviderFactory.createProvider({
    type: 'ollama',
    model: 'gemma3:12b'
  });

  const health = await provider.healthCheck();
  console.assert(health.healthy, 'Ollama should be healthy');

  const response = await provider.generate('Return JSON: {"test": true}', { jsonMode: true });
  console.assert(JSON.parse(response.content), 'Should return valid JSON');
}
```

#### test-config.js
```javascript
// 測試驗證功能
const invalidConfig = { agentId: 'test' };
const validation = AgentConfigValidator.validate(invalidConfig);
console.assert(!validation.valid, 'Should reject invalid config');

// 測試默認值填充
const minimalConfig = {
  agentId: 'test1',
  llmProvider: { type: 'ollama', model: 'gemma3:12b' }
};
const fullConfig = AgentConfigValidator.applyDefaults(minimalConfig);
console.assert(fullConfig.personality.traits.cautious === 50, 'Should apply defaults');
```

### 集成測試場景

1. **OpenAI Agent 完整流程**
   - 創建 Agent → requestNextMove → 驗證 JSON → 檢查記憶

2. **Ollama Agent 完整流程**
   - 健康檢查 → 創建 Agent → 驗證 JSON 穩定性 → 錯誤處理

3. **多 Agent 並發**
   - 創建 3 個 Agent → 同時發送決策請求 → 驗證隔離

4. **配置更新**
   - 創建 Agent → 更新配置 → 驗證 Provider 切換

---

## ⚠️ 風險與緩解

### Ollama JSON 格式不穩定

**風險**：Ollama 本地模型可能生成不完整的 JSON

**緩解方案**：
1. 使用 `format: 'json'` 強制 JSON 模式
2. Prompt 強調（逐次加強）
3. 多次重試（最多 3-5 次）
4. 使用 `extract-json-from-string` 回退

**實現**（OllamaProvider.js）：
```javascript
async generate(prompt, options = {}) {
  let attempts = 0;

  while (attempts < this.maxRetries) {
    const requestBody = {
      model: this.model,
      format: 'json'
    };

    if (attempts === 0) {
      requestBody.prompt = `You must respond with valid JSON.\n\n${prompt}`;
    } else if (attempts === 1) {
      requestBody.prompt = `CRITICAL: YOU MUST ONLY RESPOND WITH VALID JSON.\n\n${prompt}`;
    } else {
      requestBody.prompt = `LAST CHANCE: Only JSON!\n\n${prompt}`;
    }

    try {
      const response = await fetch(`${this.baseURL}/api/generate`, { ... });
      const parsed = JSON.parse(response.content);
      return parsed;
    } catch {
      const extracted = extract(response.content)[0];
      if (extracted) return extracted;
      attempts++;
    }
  }

  throw new Error('Failed after max retries');
}
```

### 向後兼容性

**風險**：新架構可能破壞現有功能

**緩解方案**：
1. 保留舊接口（Agent.js 構造函數）
2. 自動遷移（檢測 env.json 的 OPENAI_API_KEY）
3. 默認值填充

**實現**（index.js）：
```javascript
// 如果沒有提供 llmProvider 配置，使用默認配置
if (!agentConfig.llmProvider) {
  console.log('Using default provider from env.json...');
  const defaultProvider = ProviderFactory.createDefaultProvider(env);
  agentConfig.llmProvider = defaultProvider.getMetadata();
}
```

---

## 📚 配置文件範例

### agent/env.example.json

```json
{
  "comment": "Copy this file to env.json and fill in your credentials",

  "OPENAI_API_KEY": "sk-your-openai-key-here",
  "OPENAI_MODEL": "gpt-5-mini",

  "OLLAMA_BASE_URL": "http://localhost:11434",
  "OLLAMA_DEFAULT_MODEL": "gemma3:12b",

  "DATABASE_PATH": "./agent_memory.db",
  "MEMORY_SHORT_TERM_SIZE": 20,
  "MEMORY_LONG_TERM_THRESHOLD": 7,
  "MEMORY_LOCATION_RADIUS": 5
}
```

### Agent 配置範例

**探索者 Agent（OpenAI）**：
```json
{
  "agentId": "explorer_1",
  "name": "Bold Explorer",
  "llmProvider": {
    "type": "openai",
    "apiKey": "sk-...",
    "model": "gpt-5-mini",
    "temperature": 0.8
  },
  "personality": {
    "behaviorTendencies": {
      "exploration": 90,
      "collection": 40,
      "social": 30,
      "defensive": 20
    },
    "traits": {
      "cautious": 20,
      "bold": 85,
      "curious": 90,
      "lazy": 10
    },
    "description": "A fearless explorer who loves discovering new places"
  },
  "memory": {
    "shortTermSize": 25,
    "longTermThreshold": 6,
    "locationRadius": 7
  }
}
```

**收集者 Agent（Ollama）**：
```json
{
  "agentId": "collector_1",
  "name": "Careful Collector",
  "llmProvider": {
    "type": "ollama",
    "model": "gemma3:12b",
    "baseURL": "http://localhost:11434",
    "temperature": 0.5
  },
  "personality": {
    "behaviorTendencies": {
      "exploration": 30,
      "collection": 95,
      "social": 20,
      "defensive": 60
    },
    "traits": {
      "cautious": 80,
      "bold": 25,
      "curious": 45,
      "lazy": 30
    },
    "description": "A meticulous collector focused on efficiency and safety"
  },
  "memory": {
    "shortTermSize": 15,
    "longTermThreshold": 8,
    "locationRadius": 4
  },
  "toolPreferences": {
    "preferredCategories": ["farming", "survival"],
    "blockedTools": []
  }
}
```

---

## 🚀 快速開始

### 使用 Ollama Agent

1. **安裝 Ollama**
   ```bash
   # Windows/Mac/Linux
   curl https://ollama.ai/install.sh | sh
   ```

2. **拉取模型**
   ```bash
   ollama pull gemma3:12b
   ollama list  # 驗證
   ```

3. **配置 env.json**
   ```json
   {
     "OLLAMA_BASE_URL": "http://localhost:11434"
   }
   ```

4. **啟動服務**
   ```bash
   ollama serve  # 啟動 Ollama
   cd agent && npm start  # 後端
   cd ui-admin && npm start  # 前端
   ```

5. **創建 Agent（在 create.js）**
   ```javascript
   const AGENT_CONFIGS = [
     {
       agentId: "ollama_agent1",
       llmProvider: {
         type: "ollama",
         model: "gemma3:12b"
       },
       personality: {
         behaviorTendencies: { exploration: 80 }
       }
     }
   ];
   ```

---

## ✅ 實現檢查清單

### 階段一：LLM Provider 抽象層
- [ ] BaseLLMProvider.js 實現
- [ ] OpenAIProvider.js 實現
- [ ] OllamaProvider.js 實現
- [ ] ProviderFactory.js 實現
- [ ] test-providers.js 測試通過

### 階段二：配置系統
- [ ] AgentConfigSchema.js 實現
- [ ] ConfigManager.js 實現
- [ ] database.js 添加 agent_configs 表
- [ ] test-config.js 測試通過

### 階段三：ServerAgent 解耦
- [ ] 構造函數修改
- [ ] callOpenAI → callLLM
- [ ] buildEnhancedPrompt 個性化注入
- [ ] 向後兼容測試通過

### 階段四：後端整合
- [ ] index.js 導入新模組
- [ ] create_agent 消息處理重寫
- [ ] update_agent_config 消息處理
- [ ] 集成測試通過

### 階段五：前端基礎改造
- [ ] Agent.js 構造函數修改
- [ ] create.js 多 Agent 支援
- [ ] AIConsole.js Agent 過濾
- [ ] TaskManager.js Agent 標籤
- [ ] 多 Agent 運行測試通過

### 階段六：配置面板（可選）
- [ ] AgentConfigPanel.js 實現
- [ ] AgentConfigPanel.css 樣式
- [ ] App.js 整合
- [ ] UI 測試通過

---

## 📊 估計工作量

- **階段一**：2-3 小時
- **階段二**：2-3 小時
- **階段三**：1-2 小時
- **階段四**：2 小時
- **階段五**：2-3 小時
- **階段六**：3-4 小時（可選）

**總計**：12-17 小時（不含配置面板），15-21 小時（含配置面板）

---

## 🎓 關鍵技術要點

1. **Provider 模式**：解耦 LLM 依賴，易於擴展
2. **配置驅動**：每個 Agent 獨立配置，存儲在數據庫
3. **個性化 Prompt**：8 個維度動態生成性格描述
4. **向後兼容**：保留舊接口，自動遷移
5. **多層防護**：Ollama JSON 穩定性（重試 + extract + Prompt 強調）

---

## 📝 下一步

完成計劃審查後，按階段順序實現：
1. 從階段一開始，完成 Provider 抽象層
2. 每個階段完成後運行測試
3. 確保向後兼容性
4. 逐步添加新功能

準備好開始實現時，請告知！
