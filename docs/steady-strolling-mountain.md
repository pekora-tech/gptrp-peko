# 智能自動化行為系統 - 實施計劃

## 執行摘要

建立一個智能化的自動行為系統，大幅降低 AI 運作的 API 成本（目標：80% 成本降低），同時支援動態目標驅動的行為調整和自主學習能力。

### 核心目標
- **成本優化**：低階運作零 API 調用，僅在異常時才調用
- **自動化覆蓋**：導航、資源收集、複合行為鏈、常見模式
- **學習機制**：AI 主動提議自動化工具，經確認後保存
- **動態適應**：支援自然語言改變目標，自動調整行為計劃

### 預期成效
- **成本節省**：Phase 1-2 達成 60% 降低，Phase 3 達成 80% 降低
- **響應速度**：平均執行時間減少 40-60%
- **自主程度**：從完全依賴 AI 到 80% 自動化運作

---

## 系統架構概覽

```
┌─────────────────────────────────────────────────────────────┐
│                  智能自動化行為系統                            │
└─────────────────────────────────────────────────────────────┘

         ServerAgent (決策協調器)
              ↓
    ┌─────────┼─────────┐
    ↓         ↓         ↓
ToolManager  GoalManager  BehaviorExecutor
    ↓                        ↓
PatternAnalyzer ← ───────→ MemoryManager
    ↓
SQLite Database
  - tools
  - tool_executions
  - behavior_patterns
  - tool_proposals
```

### 關鍵設計原則
1. **異常驅動 API 調用**：正常流程完全自動化，只在異常時調用 AI
2. **目標驅動工具選擇**：目標改變時自動調整工具和行為
3. **漸進式學習**：預設工具 → AI 提議 → 模式識別 → 完全自主
4. **安全降級**：任何階段失敗都能回退到 AI 控制

---

## Phase 1: 基礎設施建立（1-2 週）

### 目標
建立核心組件和數據結構，實現預設工具的自動執行。

### 交付成果

#### 1. 數據庫擴展
**文件**: `agent/database.js`

新增 4 張表：
- `tools` - 工具定義表（工具名稱、步驟、前置條件、統計）
- `tool_executions` - 執行記錄表（狀態、耗時、成本節省）
- `execution_steps` - 步驟詳細記錄（每步執行結果）
- `behavior_patterns` - 行為模式表（供模式分析使用）
- `tool_proposals` - AI 提議表（提議審核流程）

#### 2. ToolManager 類
**文件**: `agent/ToolManager.js`（新建）

核心功能：
```javascript
- createTool(toolDefinition)           // 創建新工具
- findMatchingTool(currentState, intent)  // 匹配適用工具
- checkPreconditions(tool, state)      // 驗證前置條件
- updateToolStats(toolId, success)     // 更新成功率
- getAvailableToolsForPrompt(state)    // 獲取可用工具列表
```

#### 3. BehaviorExecutor 類
**文件**: `agent/BehaviorExecutor.js`（新建）

核心功能：
```javascript
- executeTool(tool, context)           // 執行工具
- executeStep(step, context, results)  // 執行單個步驟
- executeFind(step)                    // 查找資源位置
- executeNavigate(step, previousResults) // 導航到目標
- executeAction(step)                  // 執行遊戲動作
- shouldCallAI(step, result)           // 判斷是否需要 AI
- buildRecoveryContext(tool, failedStep) // 構建恢復上下文
```

#### 4. 預設工具集
**文件**: `agent/tools/presets.json`（新建）

定義 5 個基礎工具：
- `goto_bed` - 導航到床並睡覺
- `drink_water` - 導航到水源並喝水
- `chop_tree` - 尋找樹木並砍伐
- `explore_area` - 探索指定範圍
- `tired_and_thirsty` - 複合行為：先喝水再睡覺

工具定義格式：
```json
{
  "name": "goto_bed",
  "description": "Navigate to bed and sleep until rested",
  "category": "survival",
  "preconditions": [
    { "type": "state_check", "field": "sleepiness", "operator": ">", "value": 5 },
    { "type": "location_known", "resource": "bed" }
  ],
  "steps": [
    { "type": "find_location", "params": { "resource": "bed" } },
    { "type": "navigate", "params": { "useResult": 0 }, "onFailure": "call_ai" },
    { "type": "action", "params": { "actionType": "sleep" } },
    { "type": "wait", "params": { "duration": 2000 } }
  ],
  "expected_outcome": {
    "state_changes": [{ "field": "sleepiness", "operator": "<=", "value": 1 }]
  }
}
```

#### 5. 測試腳本
**文件**: `agent/test-tools.js`（新建）

測試覆蓋：
- 工具創建和存儲
- 前置條件檢查
- 工具執行流程
- 異常處理和恢復
- 成功率統計

### 驗收標準
- [ ] 5 張數據庫表創建成功，索引優化完成
- [ ] 預設工具可以成功載入到數據庫
- [ ] `goto_bed` 工具能完整執行（查找→導航→睡覺）
- [ ] 工具執行失敗時能正確記錄到 `tool_executions`
- [ ] 測試腳本全部通過

---

## Phase 2: AI 整合與工具學習（2-3 週）

### 目標
讓 AI 能夠識別、選擇和提議工具，實現主動學習機制。

### 交付成果

#### 1. ServerAgent 整合
**文件**: `agent/ServerAgent.js`（修改）

新增方法：
```javascript
// Prompt 擴展
buildEnhancedPromptWithTools(context) {
  // 注入可用工具列表到 AI prompt
  // 包含工具名稱、描述、成功率
}

// 工具執行處理
async handleToolExecution(response, context) {
  // AI 選擇使用工具時的處理邏輯
  // 執行工具，失敗時調用 AI 恢復
}

// 工具提議處理
async handleToolProposal(proposal, context) {
  // 驗證 AI 提議的工具格式
  // 保存到 tool_proposals 表
  // 自動審批（可配置）
}

// 恢復 prompt 構建
buildRecoveryPrompt(context, failureResult) {
  // 工具失敗時構建恢復指令
}
```

修改 `makeDecision()` 流程：
```javascript
async makeDecision(context) {
  // 1. 檢查是否有高置信度工具可用
  const suggestedTool = this.toolManager.suggestTool(context.currentState);
  if (suggestedTool && suggestedTool.confidence > 0.9) {
    return await this.handleToolExecution({
      action: { type: 'use_tool', tool_name: suggestedTool.name }
    }, context);
  }

  // 2. 否則詢問 AI（包含工具列表）
  const prompt = this.buildEnhancedPromptWithTools(context);
  const response = await this.callOpenAI(prompt, 0);

  // 3. 處理回應
  if (response.tool_proposal) {
    await this.handleToolProposal(response.tool_proposal, context);
  }

  if (response.action.type === 'use_tool') {
    return await this.handleToolExecution(response, context);
  }

  return response;
}
```

#### 2. Prompt 模板擴展
**位置**: `ServerAgent.js` 內的 `buildEnhancedPrompt()`

新增章節：
```
# Available Automated Tools

You have access to the following tools that execute multi-step behaviors
automatically without additional API calls:

## SURVIVAL Tools
- **goto_bed**: Navigate to bed and sleep (Reliability: 98%)
- **drink_water**: Find water source and drink (Reliability: 95%)

## RESOURCE_GATHERING Tools
- **chop_tree**: Find tree and harvest wood (Reliability: 92%)

**How to use**: Return `{ "action": { "type": "use_tool", "tool_name": "goto_bed" } }`

**Propose new tools**: If you notice repetitive patterns, suggest automation:
{
  "tool_proposal": {
    "name": "morning_routine",
    "description": "Wake up, drink water, explore nearby",
    "category": "routine",
    "steps": [...],
    "when_to_use": "At start of day when sleepiness is 0"
  }
}
```

#### 3. 前端監控增強
**文件**: `ui-admin/src/AIConsole.js`（修改）

新增顯示：
- 工具使用事件（哪個工具、執行時長、結果）
- 工具提議通知（AI 提議了新工具）
- 成本節省統計（累計節省的 API 調用數）

#### 4. 目標驅動工具選擇
**文件**: `agent/GoalManager.js`（修改）

擴展 `goals` 表的 metadata：
```json
{
  "preferred_tools": ["explore_area", "chop_tree"],
  "auto_execute": true,
  "tool_switching_rules": {
    "if_blocked": "call_ai",
    "if_resource_depleted": "switch_to_alternative"
  }
}
```

新增方法：
```javascript
getPreferredToolsForGoal(goalId) {
  // 根據目標返回推薦工具列表
}

updateGoalOnToolChange(goalId, toolResult) {
  // 工具執行後更新目標進度
}
```

### 驗收標準
- [ ] AI 能在 prompt 中看到可用工具列表
- [ ] AI 能成功選擇並使用工具（準確率 > 90%）
- [ ] AI 能提議新工具（格式驗證通過）
- [ ] 提議的工具能自動審批並創建
- [ ] 工具執行失敗時 AI 能介入恢復
- [ ] AIConsole 能顯示工具使用和成本節省

### 成本對比測試
場景：「Agent 累了 (sleepiness=8)，導航到床並睡覺」

**無工具**:
- API 調用: 6-8 次（每步移動問 AI）
- 成本: ~$0.010
- 時間: 25-40 秒

**有工具**:
- API 調用: 0 次（工具自動執行）
- 成本: $0.00
- 時間: 12-15 秒
- **節省: 100% 成本，40% 時間**

---

## Phase 3: 模式識別與動態目標適應（3-4 週）

### 目標
系統自動發現重複模式，支援自然語言改變目標時的行為動態調整。

### 交付成果

#### 1. PatternAnalyzer 類
**文件**: `agent/PatternAnalyzer.js`（新建）

核心功能：
```javascript
- analyzeRecentBehaviors(windowSize)     // 分析最近行為序列
- extractSequences(actions, length)      // 提取固定長度序列
- findRepeatedSequences(sequences, minRepeat) // 查找重複模式
- calculateConfidence(sequence)          // 計算模式可信度
- categorizePattern(sequence)            // 分類模式
- patternToToolDefinition(pattern, aiSuggestion) // 轉換為工具
- savePatternForReview(pattern)          // 保存供審核
```

模式識別觸發器：
```javascript
// 在 ServerAgent.processMessage 中
async processMessage(parsedData) {
  // ... 現有邏輯 ...

  // 每 20 個動作分析一次
  if (this.actionCount % 20 === 0) {
    await this.analyzeAndLearnPatterns();
  }

  this.actionCount++;
}

async analyzeAndLearnPatterns() {
  const patterns = this.patternAnalyzer.analyzeRecentBehaviors(50);

  for (const pattern of patterns) {
    if (pattern.confidence > 0.7 && pattern.frequency >= 3) {
      const toolDef = this.patternAnalyzer.patternToToolDefinition(pattern);

      // 自動學習（可配置）
      if (this.autoLearn && pattern.confidence > 0.85) {
        const toolId = this.toolManager.createTool(toolDef);
        console.log(`🎓 Auto-learned: ${toolDef.name}`);
      }
    }
  }
}
```

#### 2. 動態目標驅動的工具調整
**新功能**: 自然語言改變目標時自動調整行為

**場景範例**:
```
用戶: "現在專注收集木材，至少 20 個"

AI 收到指令 → 解析為新目標:
{
  goal_type: "resource",
  description: "收集 20 個木材",
  metadata: {
    resource_type: "wood",
    target_amount: 20,
    preferred_tools: ["chop_tree", "collect_wood_batch"],
    priority: 9
  }
}

ServerAgent.onGoalChange():
  1. 檢測到新目標創建
  2. 查找相關工具 → "chop_tree"
  3. 檢查工具是否適用當前目標 ✓
  4. 自動調整決策優先級：優先使用工具
  5. 如果沒有合適工具 → 提示 AI 創建新工具
```

實現方法：
```javascript
// ServerAgent.js 新增

async onGoalChange(newGoal) {
  console.log(`🎯 Goal changed: ${newGoal.description}`);

  // 1. 查找匹配目標的工具
  const relevantTools = this.toolManager.findToolsForGoal(newGoal);

  if (relevantTools.length > 0) {
    console.log(`Found ${relevantTools.length} tools for this goal`);
    this.currentStrategyTools = relevantTools;
  } else {
    // 2. 沒有現成工具，提示 AI 創建
    console.log('No existing tools for this goal, prompting AI to create one');

    const suggestion = await this.promptAIForToolCreation(newGoal);

    if (suggestion) {
      await this.handleToolProposal(suggestion);
    }
  }

  // 3. 更新決策權重
  this.goalPriority = newGoal.priority;
}

async promptAIForToolCreation(goal) {
  const prompt = `
You have a new goal: "${goal.description}"

There are no existing automated tools for this type of goal.
Please design a tool that would help accomplish this efficiently.

Respond with a tool_proposal in this format:
{
  "tool_proposal": {
    "name": "collect_wood_batch",
    "description": "Find multiple trees and collect wood until target reached",
    "category": "resource_gathering",
    "steps": [
      { "type": "find_location", "params": { "resource": "tree" } },
      { "type": "navigate", ... },
      { "type": "action", "params": { "actionType": "chop" } },
      { "type": "loop", "condition": "inventory.wood < 20", "goto": 0 }
    ]
  }
}
`;

  const response = await this.callOpenAI(prompt, 0);
  return response.tool_proposal;
}
```

#### 3. 目標-工具綁定系統
**文件**: `agent/ToolManager.js`（擴展）

新增方法：
```javascript
findToolsForGoal(goal) {
  // 根據目標類型和 metadata 查找工具
  const category = this.mapGoalTypeToCategory(goal.goal_type);

  const tools = this.db.all(`
    SELECT * FROM tools
    WHERE agent_id = ?
      AND category = ?
      AND status = 'active'
    ORDER BY success_rate DESC, usage_count DESC
  `, [this.agentId, category]);

  // 過濾出匹配目標條件的工具
  return tools.filter(tool =>
    this.toolMatchesGoal(tool, goal)
  );
}

toolMatchesGoal(tool, goal) {
  // 檢查工具的 expected_outcome 是否符合目標
  const outcome = JSON.parse(tool.expected_outcome);

  if (goal.goal_type === 'resource' && goal.metadata.resource_type) {
    // 檢查工具是否能收集該資源
    return outcome.resources_gained?.includes(goal.metadata.resource_type);
  }

  if (goal.goal_type === 'navigation' && goal.metadata.target_location) {
    // 檢查工具是否能到達目標位置
    return tool.category === 'navigation';
  }

  return true; // 其他情況通用匹配
}

// 工具與目標的動態綁定
bindToolToGoal(toolId, goalId) {
  this.db.run(`
    UPDATE tools
    SET metadata = json_set(
      COALESCE(metadata, '{}'),
      '$.bound_goal_id',
      ?
    )
    WHERE id = ?
  `, [goalId, toolId]);
}
```

#### 4. 自然語言目標解析
**文件**: `agent/GoalParser.js`（新建）

使用 LLM 解析自然語言為結構化目標：
```javascript
class GoalParser {
  async parseNaturalLanguageGoal(userInput) {
    const prompt = `
Parse the following user instruction into a structured goal:
"${userInput}"

Return JSON format:
{
  "goal_type": "resource|navigation|exploration|survival|achievement",
  "description": "Clear goal description",
  "priority": 1-10,
  "metadata": {
    // Type-specific fields:
    // For resource: { "resource_type": "wood", "target_amount": 20 }
    // For navigation: { "target_location": { "x": 10, "y": 15 } }
    // For exploration: { "target_area": "north_forest", "radius": 10 }
  }
}
`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);
  }
}
```

使用範例：
```javascript
// 用戶輸入自然語言
const userInput = "我想建造一個家，需要收集 30 個木材和 20 個石頭";

const goalParser = new GoalParser(openai);
const parsedGoal = await goalParser.parseNaturalLanguageGoal(userInput);

// 結果:
{
  goal_type: "achievement",
  description: "建造家園：收集 30 木材和 20 石頭",
  priority: 8,
  metadata: {
    sub_goals: [
      { type: "resource", resource_type: "wood", target_amount: 30 },
      { type: "resource", resource_type: "stone", target_amount: 20 }
    ],
    preferred_tools: ["collect_wood_batch", "collect_stone"],
    auto_execute: true
  }
}

// 創建目標
const goalId = goalManager.createGoal(
  parsedGoal.description,
  parsedGoal.goal_type,
  parsedGoal.priority,
  parsedGoal.metadata
);

// 觸發目標改變處理
await serverAgent.onGoalChange(parsedGoal);
```

### 驗收標準
- [ ] 模式分析器能識別重複序列（準確率 > 80%）
- [ ] 發現的模式能自動轉換為工具定義
- [ ] 自然語言目標能正確解析（準確率 > 85%）
- [ ] 目標改變時能自動查找/創建相關工具
- [ ] 工具能根據目標動態調整行為
- [ ] 工具與目標的綁定能正確追蹤

### 動態目標場景測試

**場景 1: 目標切換**
```
初始: 目標 = "探索地圖"
  → 使用工具: "explore_area"
  → 執行中...

用戶: "停止探索，現在專注收集食物"
  → 解析新目標: { goal_type: "resource", resource_type: "food" }
  → 中斷當前工具執行
  → 查找工具: "gather_food"
  → 如不存在 → AI 提議並創建
  → 開始新工具執行
```

**場景 2: 複合目標**
```
用戶: "我要建造房子，需要木材、石頭和工具"
  → 解析為 3 個子目標
  → 為每個子目標分配工具
  → 按優先級順序執行
  → 目標達成時自動切換下一個
```

---

## 關鍵文件清單

### 新建文件（7 個）
1. `agent/ToolManager.js` - 工具管理核心
2. `agent/BehaviorExecutor.js` - 工具執行引擎
3. `agent/PatternAnalyzer.js` - 模式識別與學習
4. `agent/GoalParser.js` - 自然語言目標解析
5. `agent/tools/presets.json` - 預設工具定義
6. `agent/test-tools.js` - 工具系統測試
7. `agent/test-integration-tools.js` - 端到端整合測試

### 修改文件（4 個）
1. `agent/database.js` - 新增 5 張表
2. `agent/ServerAgent.js` - 整合工具系統、目標驅動決策
3. `agent/GoalManager.js` - 目標-工具綁定
4. `ui-admin/src/AIConsole.js` - 監控面板增強

### 配置文件（1 個）
1. `agent/env.json` - 新增配置項：
   ```json
   {
     "AUTO_APPROVE_TOOLS": true,
     "AUTO_LEARN_PATTERNS": true,
     "PATTERN_ANALYSIS_INTERVAL": 20,
     "MIN_PATTERN_CONFIDENCE": 0.7
   }
   ```

---

## 實施優先級與時間規劃

### Week 1-2: Phase 1 基礎設施
- Day 1-2: 數據庫設計和表創建
- Day 3-4: ToolManager 核心實現
- Day 5-7: BehaviorExecutor 實現
- Day 8-10: 預設工具定義和測試

### Week 3-5: Phase 2 AI 整合
- Day 1-3: ServerAgent 整合工具系統
- Day 4-5: Prompt 擴展和工具提議機制
- Day 6-7: 前端監控增強
- Day 8-10: 目標驅動工具選擇
- Day 11-14: 整合測試和成本分析

### Week 6-9: Phase 3 學習與動態適應
- Day 1-4: PatternAnalyzer 實現
- Day 5-7: 模式識別自動化
- Day 8-10: GoalParser 自然語言解析
- Day 11-14: 目標-工具動態綁定
- Day 15-21: 端到端測試和優化

---

## 預期成果與成本分析

### API 成本節省

**當前成本**（無工具）:
- 每天決策: 1920 次（8 小時 × 240 次/小時）
- 每天成本: $5.76
- 月成本: $172.80

**Phase 2 後**（60% 自動化）:
- 每天 AI 決策: 768 次
- 每天成本: $2.30
- 月成本: $69.00
- **節省: $103.80/月 (60%)**

**Phase 3 後**（80% 自動化）:
- 每天 AI 決策: 384 次
- 每天成本: $1.15
- 月成本: $34.50
- **節省: $138.30/月 (80%)**

### 性能提升
- 平均響應時間: 25s → 12s（52% 提升）
- 工具覆蓋率: 0% → 80%
- AI 介入率: 100% → 20%

### ROI 分析
- 開發投入: 6-9 週
- 年成本節省: $1,659.60（單 Agent）
- 回本時間: < 2 個月
- 3 年 ROI: > 400%

---

## 風險與緩解措施

### 風險 1: 工具執行失敗率高
**緩解**:
- 嚴格的前置條件檢查
- 自適應重試機制
- AI 恢復降級

### 風險 2: 工具過時（環境變化）
**緩解**:
- 工具版本控制
- 自動驗證機制
- 過時工具標記

### 風險 3: AI 過度依賴工具
**緩解**:
- Prompt 中鼓勵探索
- 工具使用率監控
- 強制探索時段

### 風險 4: 目標切換時狀態不一致
**緩解**:
- 工具執行中斷機制
- 狀態快照和恢復
- 事務性目標切換

---

## 成功指標

### Phase 1
- [ ] 預設工具成功率 > 90%
- [ ] 工具執行耗時 < 20 秒
- [ ] 零 API 調用（工具執行期間）

### Phase 2
- [ ] API 成本降低 > 60%
- [ ] AI 工具選擇準確率 > 90%
- [ ] 工具提議格式正確率 > 95%

### Phase 3
- [ ] API 成本降低 > 80%
- [ ] 模式識別準確率 > 80%
- [ ] 目標解析準確率 > 85%
- [ ] 自動化覆蓋率 > 75%

---

## Phase 4: 探索性學習與 TODO 驅動（未來擴展）

### 目標
實現 AI 主動探索未知技能的能力，由用戶 TODO 驅動新行為學習。

### 核心概念：TODO 驅動的 Skilling

**場景**：
```
用戶介面新增 TODO: "試試看能不能在河邊釣魚"

系統處理流程：
1. TODO 解析為探索性目標
2. AI 檢查：沒有 "fishing" 工具
3. 進入 Skilling 模式（探索性學習）
4. AI 制定探索計劃
5. 執行探索，記錄每一步結果
6. 成功 → 創建新工具 | 失敗 → 記錄限制
```

### 實現設計

#### 1. TODO 系統架構
**新增數據表**：
```sql
CREATE TABLE IF NOT EXISTS user_todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  description TEXT NOT NULL,  -- "試試看能不能在河邊釣魚"
  todo_type TEXT,  -- 'exploration', 'skill_learning', 'challenge'
  priority INTEGER DEFAULT 5,
  status TEXT DEFAULT 'pending',  -- 'pending', 'in_progress', 'completed', 'impossible'

  -- 學習相關
  requires_skilling BOOLEAN DEFAULT false,
  skilling_attempts INTEGER DEFAULT 0,
  skilling_results TEXT,  -- JSON: 探索嘗試記錄

  -- 關聯
  created_goal_id INTEGER,
  created_tool_id INTEGER,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,

  FOREIGN KEY (created_goal_id) REFERENCES goals(id),
  FOREIGN KEY (created_tool_id) REFERENCES tools(id)
);
```

#### 2. TodoManager 類
**文件**: `agent/TodoManager.js`（新建）

```javascript
class TodoManager {
  constructor(db, agentId, openai) {
    this.db = db;
    this.agentId = agentId;
    this.openai = openai;
  }

  /**
   * 用戶添加新 TODO
   */
  async addTodo(description, priority = 5) {
    // 使用 LLM 分析 TODO 性質
    const analysis = await this.analyzeTodo(description);

    const result = this.db.run(`
      INSERT INTO user_todos (
        agent_id, description, todo_type, priority,
        requires_skilling, status
      ) VALUES (?, ?, ?, ?, ?, 'pending')
    `, [
      this.agentId,
      description,
      analysis.type,
      priority,
      analysis.requires_skilling
    ]);

    const todoId = result.lastInsertRowid;

    // 立即處理 TODO
    await this.processTodo(todoId);

    return todoId;
  }

  /**
   * 分析 TODO 是否需要技能學習
   */
  async analyzeTodo(description) {
    const prompt = `
Analyze this user TODO and determine if it requires the AI to learn a new skill:
"${description}"

Consider:
- Is this something the AI has done before?
- Does it require exploring unknown mechanics?
- Is it a "what if" or experimental task?

Respond in JSON:
{
  "type": "exploration|skill_learning|routine|challenge",
  "requires_skilling": true/false,
  "reasoning": "Why this requires/doesn't require new learning",
  "estimated_steps": ["step 1", "step 2", ...],
  "similar_existing_tools": ["tool_name1", "tool_name2"]
}
`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);
  }

  /**
   * 處理 TODO（核心邏輯）
   */
  async processTodo(todoId) {
    const todo = this.getTodo(todoId);

    if (todo.requires_skilling) {
      // 需要技能學習 → 進入 Skilling 模式
      await this.startSkillingMode(todo);
    } else {
      // 常規任務 → 創建目標，使用現有工具
      await this.createGoalFromTodo(todo);
    }
  }

  /**
   * 🎓 Skilling 模式（探索性學習）
   */
  async startSkillingMode(todo) {
    console.log(`🎓 Starting skilling mode for: ${todo.description}`);

    // 1. 更新 TODO 狀態
    this.db.run(`
      UPDATE user_todos
      SET status = 'in_progress', skilling_attempts = skilling_attempts + 1
      WHERE id = ?
    `, [todo.id]);

    // 2. 創建探索性目標
    const explorationGoal = {
      goal_type: 'skill_learning',
      description: `Learn: ${todo.description}`,
      priority: todo.priority + 2,  // 提高優先級
      metadata: {
        todo_id: todo.id,
        exploration_mode: true,
        allow_failure: true,
        record_all_attempts: true
      }
    };

    const goalId = this.goalManager.createGoal(
      explorationGoal.description,
      explorationGoal.goal_type,
      explorationGoal.priority,
      explorationGoal.metadata
    );

    // 3. 記錄關聯
    this.db.run(`
      UPDATE user_todos SET created_goal_id = ? WHERE id = ?
    `, [goalId, todo.id]);

    // 4. 通知 ServerAgent 進入探索模式
    return {
      mode: 'skilling',
      goal: explorationGoal,
      instructions: this.generateSkillingInstructions(todo)
    };
  }

  /**
   * 生成技能學習指令（給 AI 的 Prompt）
   */
  generateSkillingInstructions(todo) {
    return {
      type: 'skilling_mission',
      mission: todo.description,
      guidelines: [
        'This is an exploratory task - you need to learn how to do this',
        'Try different approaches and record what works and what doesn\'t',
        'Be creative and experiment with game mechanics',
        'Document each step for future automation',
        'If something fails, that\'s valuable information too'
      ],
      success_criteria: 'Successfully accomplish the task OR determine it\'s impossible',
      record_format: {
        attempts: [],
        discoveries: [],
        final_outcome: 'success|impossible|needs_more_exploration'
      }
    };
  }

  /**
   * 記錄 Skilling 嘗試結果
   */
  recordSkillingAttempt(todoId, attempt) {
    const todo = this.getTodo(todoId);
    const results = todo.skilling_results
      ? JSON.parse(todo.skilling_results)
      : { attempts: [], discoveries: [] };

    results.attempts.push({
      timestamp: new Date().toISOString(),
      actions: attempt.actions,
      outcome: attempt.outcome,
      observations: attempt.observations
    });

    if (attempt.discovery) {
      results.discoveries.push(attempt.discovery);
    }

    this.db.run(`
      UPDATE user_todos SET skilling_results = ? WHERE id = ?
    `, [JSON.stringify(results), todoId]);
  }

  /**
   * 完成 Skilling（成功學會技能）
   */
  async completeSkillingSuccess(todoId, learnedSkill) {
    console.log(`✅ Skilling successful: ${learnedSkill.name}`);

    // 1. 創建新工具
    const toolId = this.toolManager.createTool({
      name: learnedSkill.name,
      description: learnedSkill.description,
      category: learnedSkill.category || 'learned_skill',
      steps: learnedSkill.steps,
      preconditions: learnedSkill.preconditions || [],
      expected_outcome: learnedSkill.expected_outcome,
      created_by: 'skilling_mode'
    });

    // 2. 更新 TODO
    this.db.run(`
      UPDATE user_todos
      SET status = 'completed',
          completed_at = CURRENT_TIMESTAMP,
          created_tool_id = ?
      WHERE id = ?
    `, [toolId, todoId]);

    // 3. 記錄到長期記憶
    await this.memoryManager.addLongTermMemory({
      type: 'skill_learned',
      description: `Learned new skill: ${learnedSkill.name}`,
      todo_description: this.getTodo(todoId).description,
      tool_id: toolId,
      learning_process: this.getTodo(todoId).skilling_results
    }, 9);  // 高重要性

    return toolId;
  }

  /**
   * 完成 Skilling（判定不可能）
   */
  completeSkillingImpossible(todoId, reason) {
    console.log(`❌ Skilling determined impossible: ${reason}`);

    this.db.run(`
      UPDATE user_todos
      SET status = 'impossible',
          completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [todoId]);

    // 記錄限制到記憶
    this.memoryManager.addLongTermMemory({
      type: 'limitation_discovered',
      description: `Learned limitation: ${reason}`,
      todo_description: this.getTodo(todoId).description
    }, 7);
  }

  getTodo(todoId) {
    const row = this.db.get('SELECT * FROM user_todos WHERE id = ?', [todoId]);
    if (row && row.skilling_results) {
      row.skilling_results = JSON.parse(row.skilling_results);
    }
    return row;
  }

  getPendingTodos() {
    return this.db.all(`
      SELECT * FROM user_todos
      WHERE agent_id = ? AND status = 'pending'
      ORDER BY priority DESC, created_at ASC
    `, [this.agentId]);
  }
}
```

#### 3. ServerAgent 整合 Skilling 模式
**修改**: `agent/ServerAgent.js`

```javascript
async processMessage(parsedData) {
  // ... 現有邏輯 ...

  // 🆕 檢查是否有待處理的 TODO
  const pendingTodos = this.todoManager.getPendingTodos();
  if (pendingTodos.length > 0 && !this.currentGoal) {
    const nextTodo = pendingTodos[0];
    await this.todoManager.processTodo(nextTodo.id);
  }

  // 🆕 檢查當前是否在 Skilling 模式
  if (this.currentGoal?.metadata?.exploration_mode) {
    return await this.handleSkillingMode(parsedData);
  }

  // 原有決策邏輯
  return await this.makeDecision(context);
}

/**
 * 🎓 Skilling 模式處理
 */
async handleSkillingMode(parsedData) {
  const goal = this.currentGoal;
  const todo = this.todoManager.getTodo(goal.metadata.todo_id);

  // 構建 Skilling Prompt
  const prompt = this.buildSkillingPrompt(todo, parsedData);

  // 調用 AI（這是合理的 API 使用 - 探索新技能）
  const response = await this.callOpenAI(prompt, 0);

  // 記錄嘗試
  this.todoManager.recordSkillingAttempt(todo.id, {
    actions: response.action,
    outcome: response.outcome || 'attempted',
    observations: response.observations,
    discovery: response.discovery
  });

  // 檢查是否學會技能
  if (response.skill_learned) {
    await this.todoManager.completeSkillingSuccess(
      todo.id,
      response.skill_learned
    );
  } else if (response.determined_impossible) {
    this.todoManager.completeSkillingImpossible(
      todo.id,
      response.reason
    );
  }

  return response;
}

/**
 * 構建 Skilling 專用 Prompt
 */
buildSkillingPrompt(todo, currentState) {
  const instructions = this.todoManager.generateSkillingInstructions(todo);
  const previousAttempts = todo.skilling_results?.attempts || [];

  return `
# 🎓 SKILLING MODE ACTIVATED

## Your Mission
${instructions.mission}

## Guidelines
${instructions.guidelines.map(g => `- ${g}`).join('\n')}

## Current State
${JSON.stringify(currentState, null, 2)}

## Previous Attempts (${previousAttempts.length} so far)
${previousAttempts.map((a, i) => `
Attempt ${i + 1}:
- Actions: ${JSON.stringify(a.actions)}
- Outcome: ${a.outcome}
- Observations: ${a.observations}
`).join('\n')}

## Your Response Format

If you're still exploring:
{
  "action": { ... },
  "reasoning": "Why trying this approach",
  "observations": "What you noticed/learned from this action",
  "discovery": "Any new mechanic or limitation discovered (optional)"
}

If you successfully learned the skill:
{
  "skill_learned": {
    "name": "go_fishing",
    "description": "Navigate to river and fish",
    "category": "resource_gathering",
    "steps": [
      { "type": "find_location", "params": { "resource": "river" } },
      { "type": "navigate", ... },
      { "type": "action", "params": { "actionType": "fish" } }
    ],
    "preconditions": [...],
    "expected_outcome": { ... }
  },
  "reasoning": "How you figured this out"
}

If you determined it's impossible:
{
  "determined_impossible": true,
  "reason": "Why this can't be done (e.g., 'No fishing mechanic exists in this game')",
  "evidence": "What led you to this conclusion"
}

Remember: Failure is learning. Each attempt teaches you something valuable.
`;
}
```

### 4. 前端 TODO 介面
**新增**: `ui-admin/src/TodoPanel.js`

```javascript
import React, { useState, useEffect } from 'react';

function TodoPanel({ agentId, socket }) {
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');

  useEffect(() => {
    // 訂閱 TODO 更新
    socket.on('todos_updated', (data) => {
      setTodos(data.todos);
    });

    // 請求當前 TODO 列表
    socket.send(JSON.stringify({
      type: 'get_todos',
      agent_id: agentId
    }));
  }, []);

  const handleAddTodo = () => {
    socket.send(JSON.stringify({
      type: 'add_todo',
      agent_id: agentId,
      description: newTodo,
      priority: 5
    }));
    setNewTodo('');
  };

  return (
    <div className="todo-panel">
      <h3>AI Learning Goals</h3>

      <div className="todo-input">
        <input
          type="text"
          placeholder="e.g., 試試看能不能在河邊釣魚"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
        />
        <button onClick={handleAddTodo}>Add TODO</button>
      </div>

      <div className="todo-list">
        {todos.map(todo => (
          <div key={todo.id} className={`todo-item ${todo.status}`}>
            <div className="todo-header">
              <span className="todo-type">{todo.todo_type}</span>
              {todo.requires_skilling && (
                <span className="badge skilling">🎓 Learning</span>
              )}
            </div>
            <div className="todo-description">{todo.description}</div>
            <div className="todo-status">
              Status: {todo.status}
              {todo.status === 'in_progress' && (
                <span> (Attempt {todo.skilling_attempts})</span>
              )}
            </div>
            {todo.created_tool_id && (
              <div className="todo-result">
                ✅ Learned! Created tool ID: {todo.created_tool_id}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 5. 完整執行流程範例

**場景**: 用戶添加 TODO "試試看能不能在河邊釣魚"

```
Step 1: 用戶輸入
───────────────────
UI: 用戶輸入 "試試看能不能在河邊釣魚" → Add TODO

Step 2: TODO 分析
───────────────────
TodoManager.analyzeTodo()
→ AI 分析: {
    type: "skill_learning",
    requires_skilling: true,
    reasoning: "Fishing is not a known mechanic, requires exploration",
    estimated_steps: [
      "Find water/river location",
      "Move to water edge",
      "Try interaction commands",
      "Test different approaches"
    ]
  }

Step 3: 進入 Skilling 模式
───────────────────────────
TodoManager.startSkillingMode()
→ 創建探索性目標
→ 通知 ServerAgent: "exploration_mode = true"

Step 4: AI 探索嘗試 1
─────────────────────
AI Prompt: "🎓 SKILLING MODE - Mission: 試試看能不能在河邊釣魚"
AI 決策: {
  action: { type: "navigate", x: 12, y: 18 },  // 已知的河邊位置
  reasoning: "First, I need to get to the river",
  observations: "Moving towards known water location"
}
→ 執行 → 到達河邊 ✓
→ 記錄: attempt 1 成功到達

Step 5: AI 探索嘗試 2
─────────────────────
AI Prompt: "Previous attempt: Successfully navigated to river..."
AI 決策: {
  action: { type: "action", actionType: "fish" },
  reasoning: "Trying direct fish action",
  observations: "Attempting to fish..."
}
→ 執行 → 前端回應: "Unknown action: fish" ❌
→ 記錄: attempt 2 失敗 - fishing action 不存在

Step 6: AI 探索嘗試 3
─────────────────────
AI 決策: {
  action: { type: "action", actionType: "interact" },
  reasoning: "Maybe generic interact works near water",
  observations: "Trying interact..."
}
→ 執行 → 前端回應: "No interactable object" ❌
→ 記錄: attempt 3 失敗 - 沒有可互動物體

Step 7: AI 結論
───────────────
經過 3 次嘗試，AI 判斷:
{
  determined_impossible: true,
  reason: "No fishing mechanic exists in this game",
  evidence: [
    "fish action not recognized",
    "interact at water edge has no effect",
    "no fishing-related objects detected"
  ]
}

Step 8: 完成處理
────────────────
TodoManager.completeSkillingImpossible()
→ TODO 狀態: impossible
→ 記錄到長期記憶: "limitation_discovered - fishing not available"
→ 通知用戶: "❌ Determined impossible: No fishing mechanic in game"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
結果:
- API 調用: 3 次（探索性學習，合理成本）
- 獲得知識: 遊戲中沒有釣魚功能
- 避免未來浪費: AI 不會再嘗試釣魚
- 用戶反饋: 明確告知不可行
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 6. 成功案例範例

**場景**: TODO "試試看能不能種植更多植物"

```
Attempt 1: 找到可種植草地 ✓
Attempt 2: 使用 plant action → 成功種植 ✓
Attempt 3: 測試不同草地 → 發現 plantable 屬性 ✓
Attempt 4: 測試種植限制 → 發現已有植物的地方不能種 ✓

AI 學會技能:
{
  "skill_learned": {
    "name": "plant_crops_batch",
    "description": "Find plantable grass and plant multiple crops",
    "steps": [
      { "type": "find_location", "params": { "tile_property": "plantable" } },
      { "type": "navigate", ... },
      { "type": "action", "params": { "actionType": "plant" } },
      { "type": "loop", "condition": "planted_count < 5", "goto": 0 }
    ],
    "preconditions": [
      { "type": "state_check", "field": "inventory.seeds", "operator": ">", "value": 0 }
    ]
  }
}

結果: ✅ 新工具創建！未來可重複使用
```

### 驗收標準
- [ ] 用戶能在介面添加 TODO
- [ ] TODO 能自動分類（routine vs skill_learning）
- [ ] Skilling 模式能正確觸發
- [ ] AI 能進行探索性嘗試（最多 5-10 次）
- [ ] 成功時能自動創建新工具
- [ ] 失敗時能正確記錄限制
- [ ] 所有 Skilling 過程有完整日誌

### 成本控制
- **探索性學習**: 合理的 API 使用（5-10 次嘗試）
- **一次性投資**: 學會後永久自動化
- **失敗也有價值**: 避免未來重複嘗試

---

## 未來擴展方向

### 多 Agent 協作
- 工具共享機制
- 協作型複合工具
- 集體學習

### 高級學習
- 強化學習優化工具參數
- 工具效果預測
- A/B 測試工具變體
- **跨 Agent 技能遷移**（一個 Agent 學會，其他 Agent 也能用）

### 遊戲機制擴展
- 複雜資源系統（種植、建造）
- 時間和天氣系統
- NPC 互動工具
- **社區工具庫**（分享學到的技能）

---

## 附錄：工具定義範例

### 範例 1: 基礎導航工具
```json
{
  "name": "goto_bed",
  "description": "Navigate to bed location and sleep until fully rested",
  "category": "survival",
  "version": "1.0.0",
  "preconditions": [
    { "type": "state_check", "field": "sleepiness", "operator": ">", "value": 5 },
    { "type": "location_known", "resource": "bed" }
  ],
  "steps": [
    { "type": "find_location", "description": "Find bed location from memory", "params": { "resource": "bed" } },
    { "type": "navigate", "description": "Navigate to bed", "params": { "useResult": 0, "timeout": 30000 }, "onFailure": "call_ai" },
    { "type": "action", "description": "Execute sleep action", "params": { "actionType": "sleep" } },
    { "type": "wait", "description": "Wait for sleep to take effect", "params": { "duration": 2000 } }
  ],
  "expected_outcome": {
    "description": "Sleepiness reduced to near zero",
    "state_changes": [{ "field": "sleepiness", "operator": "<=", "value": 1 }]
  }
}
```

### 範例 2: 複合行為工具
```json
{
  "name": "tired_and_thirsty",
  "description": "Handle both tiredness and thirst efficiently",
  "category": "survival",
  "preconditions": [
    { "type": "state_check", "field": "sleepiness", "operator": ">", "value": 6 },
    { "type": "state_check", "field": "thirst", "operator": ">", "value": 6 }
  ],
  "steps": [
    { "type": "composite", "description": "First drink water", "sub_tool": "drink_water" },
    { "type": "composite", "description": "Then go to sleep", "sub_tool": "goto_bed" }
  ]
}
```

### 範例 3: 循環型資源收集工具
```json
{
  "name": "collect_wood_batch",
  "description": "Collect wood until target amount is reached",
  "category": "resource_gathering",
  "preconditions": [
    { "type": "location_known", "resource": "tree" }
  ],
  "steps": [
    { "type": "find_location", "params": { "resource": "tree" } },
    { "type": "navigate", "params": { "useResult": 0 }, "onFailure": "call_ai" },
    { "type": "action", "params": { "actionType": "chop" } },
    { "type": "check_state", "params": { "condition": { "type": "state_check", "field": "inventory.wood", "operator": ">=", "value": 20 } } },
    { "type": "loop", "condition": "step[3].success == false", "goto": 0 }
  ]
}
```

---

**計劃版本**: 1.0
**最後更新**: 2026-01-05
**預計完成**: 6-9 週後
