# GPTRPG 記憶與目標系統實現計劃 v2

## 🎯 專案概述

基於現有的 GPTRPG 專案，實現以下核心功能：

### 實現優先級
1. **優先**：OpenAI 主角系統（完整記憶 + 目標 + 智能決策）
2. **次要**：標籤解析架構（為 Ollama NPC 準備）
3. **未來**：Ollama NPC 系統（狗、牛等動物）

### 技術架構
- **主角 (Player)**：OpenAI GPT + 完整記憶 + 複雜目標 + JSON 格式
- **NPC 動物**：Ollama 本地模型 + 簡化記憶 + 標籤格式（Tag-based）
- **存儲**：SQLite 持久化
- **通訊**：WebSocket

---

## 🏗️ 分層實現架構（調整版）

```
┌─────────────────────────────────────────────────────────────┐
│ 階段 1: OpenAI 主角系統（優先實現）                          │
│ ├─ SQLite 數據庫設置（記憶 + 目標）                          │
│ ├─ 記憶系統（四種記憶完整實現）                              │
│ ├─ 目標系統（單一目標追蹤）                                  │
│ ├─ OpenAI 整合（嚴格 JSON 格式）                            │
│ └─ Prompt 工程優化                                          │
├─────────────────────────────────────────────────────────────┤
│ 階段 2: 標籤解析架構（為 NPC 準備）                         │
│ ├─ 設計標籤語法規範（XML-like）                             │
│ ├─ 實現標籤解析器（正則提取）                               │
│ ├─ LLM Provider 抽象層（支持 JSON + Tag 雙模式）           │
│ └─ 向後兼容性保證                                            │
├─────────────────────────────────────────────────────────────┤
│ 階段 3: Ollama NPC 系統（未來擴展）                         │
│ ├─ Ollama Provider 實現                                    │
│ ├─ NPC 代理類別（簡化版）                                   │
│ ├─ 多代理管理系統                                            │
│ └─ 前端多角色渲染                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 💡 核心技術創新：標籤系統（Tag-based Action Extraction）

### 為什麼需要標籤系統？

**傳統 JSON 方式的問題**（針對 Ollama 本地模型）：
```json
{
  "action": {
    "type": "move",
    "direction": "up"
  }
}
```
❌ Ollama 本地模型可能：
- 生成不完整的 JSON
- 格式錯誤（缺少引號、括號）
- 不穩定的輸出

**標籤方式的優勢**：
```
我現在很餓了，需要去找點草吃。
我記得北邊有一片草地，讓我往那邊走走看。

<action type="move" direction="up" />
<emotion>飢餓</emotion>
<thought>尋找食物</thought>
```
✅ 優勢：
- AI 可以自由表達思考過程（更自然、更像生命）
- 只需正則提取標籤（容錯性極高）
- 即使其他部分混亂，只要標籤正確就能執行
- 類似 Claude 的 skill 系統
- 更適合觀察 AI 的推理過程

### 標籤語法設計（草案）

```xml
<!-- 基礎移動 -->
<action type="move" direction="up|down|left|right" />

<!-- 導航到座標 -->
<action type="navigate" x="15" y="20" />

<!-- 等待 -->
<action type="wait" duration="2000" />

<!-- 睡眠 -->
<action type="sleep" />

<!-- 互動 -->
<action type="plant" />
<action type="harvest" />
<action type="eat" item="grass" />

<!-- NPC 專用：社交行為 -->
<action type="follow" target="player" />
<action type="avoid" target="player" />
<action type="graze" />  <!-- 牛吃草 -->
<action type="bark" />   <!-- 狗叫 -->

<!-- 狀態表達（可選，用於觀察） -->
<goal priority="high">尋找水源</goal>
<emotion>害怕|快樂|飢餓|疲憊</emotion>
<thought>我需要找個安全的地方</thought>
```

---

## 📦 階段 1: OpenAI 主角系統（優先實現）

> **目標**：實現一個擁有完整記憶和目標系統的智能主角，使用 OpenAI GPT 進行決策

### 1.1 SQLite 數據庫設計

**新增文件**: `agent/database.js`

**數據庫 Schema**（針對主角優化）:

```sql
-- 記憶表 (memories)
CREATE TABLE memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  memory_type TEXT NOT NULL,  -- 'short_term', 'long_term', 'location', 'interaction'
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  content TEXT NOT NULL,       -- JSON 格式的記憶內容
  importance INTEGER DEFAULT 1, -- 1-10，重要性評分
  embedding TEXT,              -- 可選：向量嵌入（未來用於語義搜索）
  INDEX idx_agent_type (agent_id, memory_type),
  INDEX idx_timestamp (timestamp)
);

-- 目標表 (goals)
CREATE TABLE goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  goal_type TEXT NOT NULL,     -- 'survival', 'exploration', 'social', etc.
  description TEXT NOT NULL,   -- 目標描述
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'failed', 'abandoned'
  priority INTEGER DEFAULT 5,  -- 1-10 優先級
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  metadata TEXT,               -- JSON 格式的額外數據
  INDEX idx_agent_status (agent_id, status)
);

-- 位置探索表 (explored_locations)
CREATE TABLE explored_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  tile_type TEXT,              -- 瓦片類型
  resources TEXT,              -- JSON: 該位置的資源 (如 bed, water, food)
  visit_count INTEGER DEFAULT 1,
  first_visited DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_visited DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(agent_id, x, y)
);

-- 互動歷史表 (interactions)
CREATE TABLE interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  interaction_type TEXT NOT NULL, -- 'plant', 'harvest', 'sleep', 'move'
  location_x INTEGER,
  location_y INTEGER,
  result TEXT,                 -- JSON: 互動結果
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_agent_type (agent_id, interaction_type)
);
```

**實現要點**:
- 使用 `better-sqlite3` 套件（同步 API，更簡單）
- 數據庫文件路徑：`agent/agent_memory.db`
- 封裝 CRUD 操作的 helper 函數

---

### 1.2 OpenAI 整合（階段 1 簡化版）

> **注意**：階段 1 先專注於 OpenAI，LLM 抽象層留到階段 2 實現

**修改文件**: `agent/ServerAgent.js`

**改進 OpenAI 調用**：
- 修正模型名稱（`gpt-5-mini` → `gpt-3.5-turbo` 或 `gpt-5-mini`）
- 使用最新的 OpenAI SDK
- 優化錯誤處理和重試機制
- 添加 response format 為 JSON mode

```javascript
// 使用 OpenAI 新版 SDK (v4+)
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

async callOpenAI(prompt, attempt = 0) {
  if (attempt > 3) return null;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",  // 或 "gpt-3.5-turbo"
      messages: [
        {
          role: "system",
          content: "你是一個智能 AI 代理。請以 JSON 格式回應。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },  // 強制 JSON 輸出
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error(`OpenAI API error (attempt ${attempt + 1}):`, error);
    return await this.callOpenAI(prompt, attempt + 1);
  }
}
```

---

### 1.3 配置系統升級

**修改文件**: `agent/env.json`

階段 1 配置（簡化版）：

```json
{
  "OPENAI_API_KEY": "sk-your-api-key-here",
  "OPENAI_MODEL": "gpt-5-mini",

  "MEMORY_SHORT_TERM_SIZE": 10,
  "MEMORY_LONG_TERM_THRESHOLD": 7,
  "MEMORY_LOCATION_RADIUS": 5,

  "DATABASE_PATH": "./agent_memory.db"
}
```

---

### 1.4 記憶系統實現（階段 1 核心）

#### 1.4.1 記憶管理器設計

**新增文件**: `agent/MemoryManager.js`

**核心功能**:

```javascript
class MemoryManager {
  constructor(db, agent_id) {
    this.db = db;  // SQLite 數據庫實例
    this.agent_id = agent_id;
  }

  // ========== 短期記憶 ==========
  async addShortTermMemory(action, result) {
    const memory = {
      action: action,        // { type: 'move', direction: 'up' }
      result: result,        // { success: true, new_position: {x, y} }
      timestamp: new Date().toISOString()
    };

    await this.db.run(`
      INSERT INTO memories (agent_id, memory_type, content, importance)
      VALUES (?, 'short_term', ?, 5)
    `, [this.agent_id, JSON.stringify(memory)]);
  }

  async getRecentActions(limit = 10) {
    const rows = await this.db.all(`
      SELECT content FROM memories
      WHERE agent_id = ? AND memory_type = 'short_term'
      ORDER BY timestamp DESC
      LIMIT ?
    `, [this.agent_id, limit]);

    return rows.map(row => JSON.parse(row.content)).reverse();
  }

  // ========== 長期記憶 ==========
  async addLongTermMemory(event, importance = 8) {
    await this.db.run(`
      INSERT INTO memories (agent_id, memory_type, content, importance)
      VALUES (?, 'long_term', ?, ?)
    `, [this.agent_id, 'long_term', JSON.stringify(event), importance]);
  }

  async getImportantMemories(minImportance = 7, limit = 5) {
    const rows = await this.db.all(`
      SELECT content FROM memories
      WHERE agent_id = ?
        AND memory_type = 'long_term'
        AND importance >= ?
      ORDER BY importance DESC, timestamp DESC
      LIMIT ?
    `, [this.agent_id, minImportance, limit]);

    return rows.map(row => JSON.parse(row.content));
  }

  // ========== 位置記憶 ==========
  async recordLocation(x, y, tileType, resources = null) {
    await this.db.run(`
      INSERT INTO explored_locations (agent_id, x, y, tile_type, resources)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(agent_id, x, y) DO UPDATE SET
        visit_count = visit_count + 1,
        last_visited = CURRENT_TIMESTAMP
    `, [this.agent_id, x, y, tileType, JSON.stringify(resources)]);
  }

  async getNearbyLocations(x, y, radius = 5) {
    const rows = await this.db.all(`
      SELECT x, y, tile_type, resources, visit_count
      FROM explored_locations
      WHERE agent_id = ?
        AND x BETWEEN ? AND ?
        AND y BETWEEN ? AND ?
      ORDER BY visit_count DESC
    `, [this.agent_id, x - radius, x + radius, y - radius, y + radius]);

    return rows;
  }

  async findResourceLocation(resourceType) {
    // 查找特定資源（如 'bed', 'water'）
    const rows = await this.db.all(`
      SELECT x, y, resources
      FROM explored_locations
      WHERE agent_id = ?
        AND resources LIKE ?
      ORDER BY last_visited DESC
      LIMIT 1
    `, [this.agent_id, `%"${resourceType}"%`]);

    return rows.length > 0 ? rows[0] : null;
  }

  // ========== 互動記憶 ==========
  async recordInteraction(type, x, y, result) {
    await this.db.run(`
      INSERT INTO interactions (agent_id, interaction_type, location_x, location_y, result)
      VALUES (?, ?, ?, ?, ?)
    `, [this.agent_id, type, x, y, JSON.stringify(result)]);
  }

  async getRecentInteractions(type = null, limit = 5) {
    let query = `
      SELECT interaction_type, location_x, location_y, result, timestamp
      FROM interactions
      WHERE agent_id = ?
    `;
    const params = [this.agent_id];

    if (type) {
      query += ` AND interaction_type = ?`;
      params.push(type);
    }

    query += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);

    const rows = await this.db.all(query, params);
    return rows.map(row => ({
      ...row,
      result: JSON.parse(row.result)
    }));
  }
}
```

#### 1.4.2 記憶注入 Prompt 機制

**修改文件**: `agent/ServerAgent.js`

在 `processMessage()` 中增強 prompt 構建（專注於主角的智能決策）：

```javascript
async processMessage(parsedData) {
  // 1. 收集記憶
  const recentActions = await this.memoryManager.getRecentActions(10);
  const importantMemories = await this.memoryManager.getImportantMemories(7, 5);
  const nearbyLocations = await this.memoryManager.getNearbyLocations(
    parsedData.position.x,
    parsedData.position.y,
    5
  );
  const recentInteractions = await this.memoryManager.getRecentInteractions(null, 5);

  // 2. 構建增強的 prompt
  const prompt = this.buildEnhancedPrompt({
    currentState: parsedData,
    recentActions,
    importantMemories,
    nearbyLocations,
    recentInteractions
  });

  // 3. 調用 LLM
  const decision = await this.llmProvider.chat([
    { role: 'user', content: prompt }
  ]);

  // 4. 記錄決策到短期記憶
  await this.memoryManager.addShortTermMemory(
    { type: 'decision', decision },
    { timestamp: new Date() }
  );

  return decision;
}

buildEnhancedPrompt({ currentState, recentActions, importantMemories, nearbyLocations, recentInteractions }) {
  return `# Introduction
你是一個生活在 2D 模擬宇宙中的 AI 代理。你有記憶能力，可以記住過去的行動和經驗。

# Current State
Position: ${JSON.stringify(currentState.position)}
Surroundings: ${JSON.stringify(currentState.surroundings)}
Sleepiness: ${currentState.sleepiness} out of 10

# Recent Actions (短期記憶)
${recentActions.map((a, i) => `${i + 1}. ${JSON.stringify(a)}`).join('\n')}

# Important Memories (長期記憶)
${importantMemories.map((m, i) => `${i + 1}. ${m.description}`).join('\n')}

# Known Locations (位置記憶)
${nearbyLocations.map(loc => `- (${loc.x}, ${loc.y}): ${loc.tile_type}, visited ${loc.visit_count} times`).join('\n')}

# Recent Interactions (互動記憶)
${recentInteractions.map(int => `- ${int.interaction_type} at (${int.location_x}, ${int.location_y})`).join('\n')}

# Capabilities
* Move (up, down, left, right)
* Wait
* Navigate (to x,y coordinate)
* Sleep (only at bed location)

# Response Format
請以 JSON 格式回應:
{
  "action": {
    "type": "move" | "wait" | "navigate" | "sleep",
    "direction": "up" | "down" | "left" | "right",  // for move
    "x": number,  // for navigate
    "y": number   // for navigate
  },
  "reasoning": "你的思考過程"
}`;
}
```

---

### 1.5 目標系統實現（階段 1 核心）

#### 1.5.1 目標管理器設計

**新增文件**: `agent/GoalManager.js`

```javascript
class GoalManager {
  constructor(db, agent_id) {
    this.db = db;
    this.agent_id = agent_id;
  }

  // 創建新目標
  async createGoal(description, goalType = 'general', priority = 5) {
    const result = await this.db.run(`
      INSERT INTO goals (agent_id, goal_type, description, priority, status)
      VALUES (?, ?, ?, ?, 'active')
    `, [this.agent_id, goalType, description, priority]);

    return result.lastID;
  }

  // 獲取當前活躍目標
  async getCurrentGoal() {
    const row = await this.db.get(`
      SELECT * FROM goals
      WHERE agent_id = ? AND status = 'active'
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
    `, [this.agent_id]);

    return row;
  }

  // 完成目標
  async completeGoal(goalId) {
    await this.db.run(`
      UPDATE goals
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [goalId]);
  }

  // 放棄目標
  async abandonGoal(goalId) {
    await this.db.run(`
      UPDATE goals
      SET status = 'abandoned'
      WHERE id = ?
    `, [goalId]);
  }

  // 檢查目標是否達成（基於條件）
  async checkGoalCompletion(currentState) {
    const goal = await this.getCurrentGoal();
    if (!goal) return null;

    // 簡單的目標達成判斷邏輯
    const metadata = goal.metadata ? JSON.parse(goal.metadata) : {};

    // 示例：如果目標是到達某個位置
    if (metadata.target_location) {
      const { x, y } = metadata.target_location;
      if (currentState.position.x === x && currentState.position.y === y) {
        await this.completeGoal(goal.id);
        return { completed: true, goal };
      }
    }

    // 示例：如果目標是睡眠且睡意歸零
    if (goal.goal_type === 'sleep' && currentState.sleepiness === 0) {
      await this.completeGoal(goal.id);
      return { completed: true, goal };
    }

    return { completed: false, goal };
  }
}
```

#### 1.5.2 目標驅動決策

**修改文件**: `agent/ServerAgent.js`

在 prompt 中加入目標信息（主角的目標規劃能力）：

```javascript
buildEnhancedPrompt({ currentState, recentActions, importantMemories, nearbyLocations, recentInteractions, currentGoal }) {
  let goalSection = '';
  if (currentGoal) {
    goalSection = `
# Current Goal
**目標**: ${currentGoal.description}
**優先級**: ${currentGoal.priority}/10
**類型**: ${currentGoal.goal_type}

請優先考慮達成當前目標。
`;
  } else {
    goalSection = `
# Current Goal
目前沒有活躍目標。請根據當前狀態設定一個合理的目標（如：休息、探索、尋找資源等）。
`;
  }

  return `# Introduction
你是一個生活在 2D 模擬宇宙中的 AI 代理。你有記憶能力和目標追蹤能力。

${goalSection}

# Current State
...
（其他部分保持不變）
...

# Response Format
請以 JSON 格式回應:
{
  "action": { ... },
  "reasoning": "你的思考過程",
  "new_goal": "如果需要設定新目標，在此描述（可選）"
}`;
}
```

---

### 1.6 系統整合（階段 1 最終步驟）

#### 1.6.1 ServerAgent 完整整合

**修改文件**: `agent/ServerAgent.js`

完整整合記憶、目標和 OpenAI 系統：

```javascript
class ServerAgent {
  constructor(agentId, llmProvider, memoryManager, goalManager) {
    this.agentId = agentId;
    this.llmProvider = llmProvider;
    this.memoryManager = memoryManager;
    this.goalManager = goalManager;
  }

  async processMessage(parsedData) {
    // 1. 檢查目標達成
    const goalCheck = await this.goalManager.checkGoalCompletion(parsedData);
    if (goalCheck?.completed) {
      // 記錄到長期記憶
      await this.memoryManager.addLongTermMemory({
        type: 'goal_completed',
        description: `完成目標: ${goalCheck.goal.description}`,
        timestamp: new Date().toISOString()
      }, 9);
    }

    // 2. 記錄當前位置
    await this.memoryManager.recordLocation(
      parsedData.position.x,
      parsedData.position.y,
      'explored'
    );

    // 3. 收集記憶和目標
    const context = await this.buildContext(parsedData);

    // 4. 調用 LLM 做決策
    const decision = await this.makeDecision(context);

    // 5. 處理新目標（如果 AI 設定了新目標）
    if (decision.new_goal) {
      await this.goalManager.createGoal(decision.new_goal);
    }

    // 6. 記錄決策到短期記憶
    await this.memoryManager.addShortTermMemory(
      { type: 'decision', action: decision.action },
      { reasoning: decision.reasoning }
    );

    return decision;
  }

  async buildContext(parsedData) {
    return {
      currentState: parsedData,
      recentActions: await this.memoryManager.getRecentActions(10),
      importantMemories: await this.memoryManager.getImportantMemories(7, 5),
      nearbyLocations: await this.memoryManager.getNearbyLocations(
        parsedData.position.x,
        parsedData.position.y,
        5
      ),
      recentInteractions: await this.memoryManager.getRecentInteractions(null, 5),
      currentGoal: await this.goalManager.getCurrentGoal()
    };
  }

  async makeDecision(context) {
    const prompt = this.buildEnhancedPrompt(context);
    const response = await this.llmProvider.chat([
      { role: 'user', content: prompt }
    ]);

    return this.parseDecision(response);
  }

  parseDecision(response) {
    // 使用 extract-json-from-string 提取 JSON
    const extract = require('extract-json-from-string');
    const extracted = extract(response)[0];
    return extracted || { action: { type: 'wait' } };
  }
}
```

**修改文件**: `agent/index.js`

初始化所有新組件：

```javascript
const { WebSocketServer } = require('ws');
const ServerAgent = require('./ServerAgent');
const Database = require('./database');
const LLMProvider = require('./LLMProvider');
const MemoryManager = require('./MemoryManager');
const GoalManager = require('./GoalManager');
const env = require('./env.json');

// 初始化數據庫
const db = new Database(env.DATABASE_PATH);

// 初始化 LLM Provider
const llmProvider = new LLMProvider(env);

const wss = new WebSocketServer({ port: 8080 });
const agents = {};

wss.on('connection', function connection(ws) {
  ws.on('message', async function message(data) {
    const parsedData = JSON.parse(data);

    if (parsedData.type === 'create_agent') {
      const agentId = parsedData.agent_id;

      if (!agents[agentId]) {
        // 創建記憶和目標管理器
        const memoryManager = new MemoryManager(db, agentId);
        const goalManager = new GoalManager(db, agentId);

        // 創建 ServerAgent
        agents[agentId] = new ServerAgent(
          agentId,
          llmProvider,
          memoryManager,
          goalManager
        );

        ws.send(JSON.stringify({
          type: 'agent_created',
          success: true,
          agent_id: agentId
        }));
      }
    }

    else if (parsedData.type === 'requestNextMove') {
      const agentId = parsedData.agent_id;

      if (agents[agentId]) {
        const decision = await agents[agentId].processMessage(parsedData);

        ws.send(JSON.stringify({
          type: 'nextMove',
          agent_id: agentId,
          data: decision
        }));
      }
    }
  });
});

console.log('WebSocket server listening on port 8080');
console.log(`LLM Mode: ${env.LLM_MODE}`);
```

#### 1.6.2 WebSocket 伺服器整合

**修改文件**: `agent/index.js`

初始化所有組件（數據庫、記憶、目標管理器）：

```javascript
const { WebSocketServer } = require('ws');
const ServerAgent = require('./ServerAgent');
const Database = require('./database');
const MemoryManager = require('./MemoryManager');
const GoalManager = require('./GoalManager');
const env = require('./env.json');

// 初始化數據庫
const db = new Database(env.DATABASE_PATH);

const wss = new WebSocketServer({ port: 8080 });
const agents = {};

wss.on('connection', function connection(ws) {
  ws.on('message', async function message(data) {
    const parsedData = JSON.parse(data);

    if (parsedData.type === 'create_agent') {
      const agentId = parsedData.agent_id;

      if (!agents[agentId]) {
        // 創建記憶和目標管理器
        const memoryManager = new MemoryManager(db, agentId);
        const goalManager = new GoalManager(db, agentId);

        // 創建 ServerAgent（使用 OpenAI）
        agents[agentId] = new ServerAgent(
          agentId,
          memoryManager,
          goalManager,
          env  // 傳入配置
        );

        ws.send(JSON.stringify({
          type: 'agent_created',
          success: true,
          agent_id: agentId
        }));
      }
    }

    else if (parsedData.type === 'requestNextMove') {
      const agentId = parsedData.agent_id;

      if (agents[agentId]) {
        const decision = await agents[agentId].processMessage(parsedData);

        ws.send(JSON.stringify({
          type: 'nextMove',
          agent_id: agentId,
          data: decision
        }));
      }
    }
  });
});

console.log('WebSocket server listening on port 8080');
console.log(`OpenAI Model: ${env.OPENAI_MODEL}`);
```

---

#### 1.6.3 前端互動記錄（可選增強）

**修改文件**: `ui-admin/src/Agent.js`

記錄互動行為到後端（如種植、收穫、睡眠）：

```javascript
// 在執行睡眠動作後
case 'sleep':
  const { x, y } = this.getCharacterPosition();
  if(x === this.bedPosition.x && y === this.bedPosition.y) {
    this.sleepiness = 0;

    // 通知後端記錄互動
    this.socket.send(JSON.stringify({
      type: 'recordInteraction',
      agent_id: this.agent_id,
      interaction: {
        type: 'sleep',
        location: { x, y },
        result: { success: true, sleepiness_reset: true }
      }
    }));
  }
  this.nextMove();
  break;
```

---

### 1.7 階段 1 實現步驟總結

**優先級順序**（按照依賴關係）：

#### Step 1: 基礎設施（2-3 小時）
1. ✅ 安裝依賴
   ```bash
   cd agent
   npm install better-sqlite3 openai@latest
   ```
2. ✅ 創建 `agent/database.js` - SQLite 封裝
3. ✅ 修改 `agent/env.json` - 添加配置
4. ✅ 測試數據庫連接

#### Step 2: 記憶系統（3-4 小時）
5. ✅ 創建 `agent/MemoryManager.js` - 四種記憶實現
6. ✅ 測試記憶 CRUD 操作
7. ✅ 測試記憶檢索和排序

#### Step 3: 目標系統（2-3 小時）
8. ✅ 創建 `agent/GoalManager.js` - 目標管理
9. ✅ 測試目標創建、完成、放棄流程
10. ✅ 測試目標達成判斷邏輯

#### Step 4: OpenAI 整合（2-3 小時）
11. ✅ 修改 `agent/ServerAgent.js` - 升級 OpenAI SDK
12. ✅ 實現記憶注入 Prompt
13. ✅ 實現目標驅動決策
14. ✅ 測試完整決策循環

#### Step 5: 系統整合（2-3 小時）
15. ✅ 修改 `agent/index.js` - 組件初始化
16. ✅ 端到端測試（前後端完整流程）
17. ✅ Prompt 優化和調試
18. ✅ 文檔更新（README.md）

**總計時間**：約 11-16 小時

---

---

## 📦 階段 2: 標籤解析架構（為 NPC 準備）

> **目標**：設計並實現標籤解析系統，為未來的 Ollama NPC 提供寬鬆的輸出格式支持

### 2.1 標籤解析器設計

**新增文件**: `agent/TagParser.js`

**核心功能**：
- 從自由文字中提取結構化的行動標籤
- 支持多種標籤格式（action, goal, emotion, thought）
- 容錯機制（即使格式不完美也能提取）

```javascript
class TagParser {
  /**
   * 從文字中解析所有標籤
   * @param {string} text - LLM 輸出的原始文字
   * @returns {Object} 解析後的結構化數據
   */
  static parse(text) {
    return {
      action: this.extractAction(text),
      goal: this.extractGoal(text),
      emotion: this.extractEmotion(text),
      thought: this.extractThought(text),
      rawText: text  // 保留原始輸出用於調試和觀察
    };
  }

  /**
   * 提取行動標籤
   * 支持格式：
   * - <action type="move" direction="up" />
   * - <action type="navigate" x="15" y="20" />
   * - <action type="sleep" />
   */
  static extractAction(text) {
    // 正則模式 1: 自閉合標籤
    const selfClosingPattern = /<action\s+type="(\w+)"([^/>]*)\/>/;
    const match = text.match(selfClosingPattern);

    if (!match) return null;

    const actionType = match[1];
    const attributes = this.parseAttributes(match[2]);

    return {
      type: actionType,
      ...attributes
    };
  }

  /**
   * 解析標籤屬性
   * 例如：direction="up" x="15" y="20"
   */
  static parseAttributes(attrString) {
    const attrs = {};
    const attrPattern = /(\w+)="([^"]*)"/g;
    let attrMatch;

    while ((attrMatch = attrPattern.exec(attrString)) !== null) {
      const key = attrMatch[1];
      const value = attrMatch[2];

      // 嘗試轉換為數字
      attrs[key] = isNaN(value) ? value : Number(value);
    }

    return attrs;
  }

  /**
   * 提取目標標籤
   * 支持格式：<goal priority="high">尋找水源</goal>
   */
  static extractGoal(text) {
    const goalPattern = /<goal(?:\s+priority="(\w+)")?>([^<]+)<\/goal>/;
    const match = text.match(goalPattern);

    if (!match) return null;

    return {
      description: match[2].trim(),
      priority: match[1] || 'medium'
    };
  }

  /**
   * 提取情緒標籤
   * 支持格式：<emotion>飢餓</emotion>
   */
  static extractEmotion(text) {
    const emotionPattern = /<emotion>([^<]+)<\/emotion>/;
    const match = text.match(emotionPattern);
    return match ? match[1].trim() : null;
  }

  /**
   * 提取思考標籤
   * 支持格式：<thought>我需要找個安全的地方</thought>
   */
  static extractThought(text) {
    const thoughtPattern = /<thought>([^<]+)<\/thought>/;
    const match = text.match(thoughtPattern);
    return match ? match[1].trim() : null;
  }
}

module.exports = TagParser;
```

### 2.2 LLM Provider 抽象層

**新增文件**: `agent/LLMProvider.js`

支持雙模式：JSON（OpenAI）和 Tag（Ollama）

```javascript
const OpenAI = require('openai');
const TagParser = require('./TagParser');

class LLMProvider {
  constructor(config) {
    this.config = config;
    this.mode = config.LLM_MODE || 'openai';
    this.outputFormat = config.OUTPUT_FORMAT || 'json'; // 'json' 或 'tag'

    if (this.mode === 'openai') {
      this.client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
    }
    // Ollama 初始化（階段 3 實現）
  }

  /**
   * 統一的聊天接口
   * @param {Array} messages - 對話訊息
   * @param {Object} options - 選項（format: 'json' 或 'tag'）
   */
  async chat(messages, options = {}) {
    const format = options.format || this.outputFormat;

    if (this.mode === 'openai') {
      return await this.chatOpenAI(messages, format);
    } else if (this.mode === 'ollama') {
      return await this.chatOllama(messages, format);
    }
  }

  /**
   * OpenAI 調用（支持 JSON 和 Tag 雙模式）
   */
  async chatOpenAI(messages, format) {
    const apiOptions = {
      model: this.config.OPENAI_MODEL || 'gpt-5-mini',
      messages: messages,
      temperature: 0.7,
    };

    // JSON 模式：嚴格 JSON 輸出
    if (format === 'json') {
      apiOptions.response_format = { type: 'json_object' };
    }
    // Tag 模式：自由文字 + 標籤

    const response = await this.client.chat.completions.create(apiOptions);
    const content = response.choices[0].message.content;

    // 根據格式解析回應
    if (format === 'json') {
      return JSON.parse(content);
    } else if (format === 'tag') {
      return TagParser.parse(content);
    }
  }

  /**
   * Ollama 調用（階段 3 實現）
   */
  async chatOllama(messages, format) {
    // TODO: 階段 3 實現
    throw new Error('Ollama support coming in Stage 3');
  }
}

module.exports = LLMProvider;
```

### 2.3 配置更新

**修改文件**: `agent/env.json`

添加輸出格式配置：

```json
{
  "LLM_MODE": "openai",
  "OUTPUT_FORMAT": "json",  // 或 "tag"

  "OPENAI_API_KEY": "sk-your-api-key-here",
  "OPENAI_MODEL": "gpt-5-mini",

  "MEMORY_SHORT_TERM_SIZE": 10,
  "MEMORY_LONG_TERM_THRESHOLD": 7,
  "MEMORY_LOCATION_RADIUS": 5,

  "DATABASE_PATH": "./agent_memory.db"
}
```

### 2.4 ServerAgent 適配

**修改文件**: `agent/ServerAgent.js`

使用 LLMProvider 抽象層（替代直接調用 OpenAI）：

```javascript
const LLMProvider = require('./LLMProvider');

class ServerAgent {
  constructor(agentId, memoryManager, goalManager, config) {
    this.agentId = agentId;
    this.memoryManager = memoryManager;
    this.goalManager = goalManager;
    this.config = config;

    // 使用 LLM Provider
    this.llmProvider = new LLMProvider(config);
  }

  async makeDecision(context) {
    const prompt = this.buildEnhancedPrompt(context);

    // 主角使用 JSON 格式（嚴格）
    const response = await this.llmProvider.chat([
      { role: 'system', content: '你是一個智能 AI 代理。' },
      { role: 'user', content: prompt }
    ], { format: 'json' });

    return response;
  }
}
```

---

## 📦 階段 3: Ollama NPC 系統（未來擴展）

> **目標**：實現基於 Ollama 本地模型的 NPC 動物系統（狗、牛、雞等）

### 3.1 Ollama Provider 實現

**修改文件**: `agent/LLMProvider.js`

添加 Ollama 調用邏輯：

```javascript
async chatOllama(messages, format) {
  const response = await fetch(`${this.config.OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: this.config.OLLAMA_MODEL,
      messages: messages,
      stream: false,
      // 注意：Ollama 不強制 JSON，因此使用 Tag 格式
    })
  });

  const data = await response.json();
  const content = data.message.content;

  // Ollama 使用 Tag 格式解析
  return TagParser.parse(content);
}
```

### 3.2 NPC 代理類別

**新增文件**: `agent/NPCAgent.js`

簡化版的 NPC 代理（不需要完整的記憶和目標系統）：

```javascript
class NPCAgent {
  constructor(agentId, animalType, llmProvider, db) {
    this.agentId = agentId;
    this.animalType = animalType;  // 'dog', 'cow', 'chicken'
    this.llmProvider = llmProvider;
    this.db = db;

    // 簡化的狀態
    this.state = {
      hunger: 0,
      fear: 0,
      curiosity: 5
    };

    // 簡短的記憶（僅 3-5 個最近行動）
    this.recentActions = [];
  }

  async processMessage(parsedData) {
    const prompt = this.buildNPCPrompt(parsedData);

    // NPC 使用 Tag 格式（寬鬆）
    const response = await this.llmProvider.chat([
      { role: 'user', content: prompt }
    ], { format: 'tag' });

    // 記錄行動
    this.recentActions.push(response.action);
    if (this.recentActions.length > 5) {
      this.recentActions.shift();
    }

    return response;
  }

  buildNPCPrompt(parsedData) {
    const animalPersona = this.getAnimalPersona();

    return `你是一隻${animalPersona.name}。

${animalPersona.description}

當前狀態:
- 位置: (${parsedData.position.x}, ${parsedData.position.y})
- 飢餓: ${this.state.hunger}/10
- 恐懼: ${this.state.fear}/10

最近行動:
${this.recentActions.map((a, i) => `${i + 1}. ${JSON.stringify(a)}`).join('\n')}

請決定下一步行動。你可以自由表達你的想法，但必須在最後包含行動標籤。

範例:
我現在有點餓了，想要去找點草吃。北邊好像有一片草地。

<action type="move" direction="up" />
<emotion>飢餓</emotion>

現在輪到你了：`;
  }

  getAnimalPersona() {
    const personas = {
      dog: {
        name: '狗',
        description: '你忠誠、好奇、喜歡跟隨主人。你會吠叫、玩耍、追逐東西。'
      },
      cow: {
        name: '牛',
        description: '你溫和、愛吃草、行動緩慢。你喜歡在草地上吃草和休息。'
      },
      chicken: {
        name: '雞',
        description: '你膽小、愛吃種子、經常四處啄食。你會下蛋、發出咯咯聲。'
      }
    };

    return personas[this.animalType] || personas.dog;
  }
}

module.exports = NPCAgent;
```

### 3.3 多代理管理系統

**修改文件**: `agent/index.js`

支持主角（OpenAI）和多個 NPC（Ollama）：

```javascript
// 擴展後的代理管理
const agents = {
  players: {},  // 主角（使用 OpenAI）
  npcs: {}      // NPC（使用 Ollama）
};

if (parsedData.type === 'create_agent') {
  const { agent_id, agent_type, animal_type } = parsedData;

  if (agent_type === 'player') {
    // 創建主角（完整系統）
    const memoryManager = new MemoryManager(db, agent_id);
    const goalManager = new GoalManager(db, agent_id);
    agents.players[agent_id] = new ServerAgent(/*...*/);
  }
  else if (agent_type === 'npc') {
    // 創建 NPC（簡化系統 + Ollama）
    agents.npcs[agent_id] = new NPCAgent(
      agent_id,
      animal_type,  // 'dog', 'cow', 'chicken'
      ollamaProvider,
      db
    );
  }
}
```

### 3.4 前端多角色渲染

**修改文件**: `ui-admin/src/create.js`

支持多個角色同時渲染：

```javascript
// 創建主角
const playerSprite = this.add.sprite(0, 0, 'player');
this.gridEngine.create(this.fieldMapTileMap, {
  characters: [
    {
      id: 'player',
      sprite: playerSprite,
      startPosition: { x: 7, y: 6 }
    }
  ]
});
this.playerAgent = new Agent(this.gridEngine, 'player', 'player');

// 創建 NPC（狗）
const dogSprite = this.add.sprite(0, 0, 'dog');
this.gridEngine.addCharacter({
  id: 'dog1',
  sprite: dogSprite,
  startPosition: { x: 10, y: 10 }
});
this.dogAgent = new Agent(this.gridEngine, 'dog1', 'npc', 'dog');
```

---

## 📝 階段 1 關鍵文件清單

### 新增文件
- `agent/database.js` - SQLite 數據庫封裝
- `agent/MemoryManager.js` - 記憶管理器（四種記憶）
- `agent/GoalManager.js` - 目標管理器
- `agent/agent_memory.db` - SQLite 數據庫文件（自動生成）

### 修改文件
- `agent/ServerAgent.js` - 核心決策邏輯（整合記憶、目標、OpenAI）
- `agent/index.js` - WebSocket 伺服器（初始化組件）
- `agent/env.json` - 配置文件
- `ui-admin/src/Agent.js` - 前端代理（可選：記錄互動）
- `README.md` - 更新文檔

---

## 向後兼容性保證

1. **不破壞現有功能**：
   - 所有新功能都是增強性的，不改變現有的基本決策流程
   - 即使記憶系統失效，仍可正常運行（降級到無記憶模式）

2. **漸進式實現**：
   - 每個階段都可以獨立測試
   - 可以先實現基礎架構，再逐步添加記憶和目標功能

3. **配置驅動**：
   - 可通過 `env.json` 開關功能
   - 支持 OpenAI 和 Ollama 無縫切換

---

## 測試計劃

### 單元測試
- 數據庫 CRUD 操作
- 記憶檢索和排序
- 目標狀態轉換
- LLM 提供者切換

### 整合測試
- 完整的決策循環（含記憶注入）
- 目標達成判斷
- 跨會話記憶持久化
- Ollama 與 OpenAI 行為一致性

### 性能測試
- 記憶檢索延遲（應 < 50ms）
- 數據庫查詢優化
- Prompt 大小控制（避免超過 token 限制）

---

## 預期成果

實現後，AI 代理將具備：

1. **記憶能力**：
   - 記住最近 10 個行動
   - 記住重要事件和經驗
   - 記住探索過的位置和資源
   - 記住互動歷史

2. **目標驅動**：
   - 能設定和追蹤單一目標
   - 目標達成後自動設定新目標
   - 根據目標優化決策

3. **靈活的 LLM**：
   - 可選擇 OpenAI 或 Ollama
   - 易於擴展到其他 LLM 提供者

4. **持久化**：
   - 記憶保存在 SQLite
   - 重啟後保留歷史數據

---

## 風險與挑戰

1. **Prompt 長度**：
   - 記憶過多可能超過 token 限制
   - 解決：智能篩選最相關的記憶

2. **Ollama 格式不一致**：
   - Ollama 輸出可能不穩定
   - 解決：強制 JSON 格式 + 多次重試

3. **數據庫性能**：
   - 大量記憶可能導致查詢變慢
   - 解決：添加索引 + 定期清理舊記憶

4. **目標判斷邏輯**：
   - 簡單的目標可能不夠智能
   - 解決：逐步擴展目標類型和判斷條件

---

## 未來擴展方向

1. **向量搜索記憶**：使用 embedding 進行語義搜索
2. **多目標優先級**：支持目標隊列
3. **情感系統**：基於記憶形成情感狀態
4. **社交記憶**：記住與其他代理的互動
5. **學習系統**：從經驗中學習並調整行為模式
