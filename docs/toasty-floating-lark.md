# 自動返回床上功能實作計畫

## 需求總結

實現 Agent 自動返回床上睡覺的功能，具備以下特性：

1. **床位置記錄**：Agent 第一次經過床時自動記錄到 `explored_locations` 表
2. **AI 驅動觸發**：由 AI 決定何時使用 `goto_bed` 工具（而非強制自動執行）
3. **前端執行工具**：後端決定使用工具，前端接收並執行工具步驟
4. **暫停 AI 輪詢**：工具執行期間不發起新的 OpenAI 請求
5. **失敗處理**：導航失敗時交回 AI 控制重新規劃

## 系統現狀

### 已存在的組件
- ✅ `explored_locations` 資料表（database.js）
- ✅ `MemoryManager.recordLocation()` 和 `findResourceLocation()` 方法
- ✅ Grid Engine `moveTo()` 自動尋路功能
- ✅ `goto_bed` 工具定義（agent/tools/presets.json）
- ✅ `ToolManager` 和 `BehaviorExecutor` 類別

### 缺少的功能
- ❌ 床位置記錄機制
- ❌ 工具系統與 AI 決策流程整合
- ❌ 前端工具執行框架
- ❌ 工具執行期間暫停 AI 機制

## 實作步驟

### 步驟 1：床位置自動記錄（前端）

**檔案：** `ui-admin/src/Agent.js`

在 `nextMove()` 方法中加入床位置檢測邏輯：

```javascript
nextMove() {
  const characterPosition = this.getCharacterPosition();
  const surroundings = this.getSurroundings();
  this.increaseSleepiness();

  // 新增：檢查是否在床的位置
  if (characterPosition.x === this.bedPosition.x &&
      characterPosition.y === this.bedPosition.y) {
    // 發送記錄床位置的請求
    this.socket.send(JSON.stringify({
      type: 'record_location',
      agent_id: this.agent_id,
      position: characterPosition,
      tile_type: 'bed',
      resources: { bed: true }
    }));
  }

  this.socket.send(
    JSON.stringify({
      type: 'requestNextMove',
      agent_id: this.agent_id,
      position: characterPosition,
      surroundings: surroundings,
      sleepiness: this.sleepiness
    })
  );
}
```

### 步驟 2：後端處理床位置記錄

**檔案：** `agent/index.js`

在 WebSocket 訊息處理中新增 `record_location` 處理：

```javascript
else if (parsedData.type === 'record_location') {
  const agentId = parsedData.agent_id;
  const position = parsedData.position;
  const tileType = parsedData.tile_type || 'explored';
  const resources = parsedData.resources || null;

  if (agents[agentId] && agents[agentId].memoryManager) {
    await agents[agentId].memoryManager.recordLocation(
      position.x,
      position.y,
      tileType,
      resources
    );
    console.log(`✓ Location recorded: (${position.x}, ${position.y}) as ${tileType}`);
  }
}
```

### 步驟 3：初始化工具系統（後端）

**檔案：** `agent/index.js`

在 Agent 創建時初始化 ToolManager 和 BehaviorExecutor：

```javascript
import ToolManager from './ToolManager.js';
import BehaviorExecutor from './BehaviorExecutor.js';
import fs from 'fs';

// 在 create_agent 訊息處理中
if (parsedData.type === 'create_agent') {
  const agentId = parsedData.agent_id;

  // ... 現有的初始化代碼 ...

  // 新增：初始化工具系統
  const toolManager = new ToolManager(db, agentId);
  const behaviorExecutor = new BehaviorExecutor(db, agentId, toolManager, memoryManager);

  // 載入預設工具
  try {
    const presetsPath = './agent/tools/presets.json';
    const presets = JSON.parse(fs.readFileSync(presetsPath, 'utf-8'));

    for (const toolDef of presets) {
      await toolManager.createTool(
        toolDef.name,
        toolDef.description,
        toolDef.category,
        toolDef.steps,
        toolDef.preconditions || []
      );
    }
    console.log(`✓ Loaded ${presets.length} preset tools for agent ${agentId}`);
  } catch (error) {
    console.error('Failed to load preset tools:', error);
  }

  // 附加到 ServerAgent
  agents[agentId].toolManager = toolManager;
  agents[agentId].behaviorExecutor = behaviorExecutor;
}
```

### 步驟 4：AI 決策中整合工具建議

**檔案：** `agent/ServerAgent.js`

修改 `buildEnhancedPrompt()` 方法，加入可用工具資訊：

```javascript
async buildEnhancedPrompt(parsedData, context) {
  // ... 現有的 sections ...

  // 新增：可用工具部分
  let toolsSection = '';
  if (this.toolManager) {
    const availableTools = await this.toolManager.getAvailableTools(parsedData);
    if (availableTools.length > 0) {
      toolsSection = `
# Available Tools

You can use predefined tools for common tasks. To use a tool, respond with:
{
  "action": { "type": "use_tool", "tool_name": "tool_name_here" },
  "reasoning": "Why using this tool"
}

Available tools:
${availableTools.map(tool =>
  `- **${tool.name}**: ${tool.description} (success rate: ${(tool.success_rate * 100).toFixed(0)}%)`
).join('\n')}
`;
    }
  }

  // 在 prompt 組合中加入
  return `# Introduction
...
${toolsSection}
# Current State
...
`;
}
```

修改 `processMessage()` 方法，檢查 AI 是否選擇使用工具：

```javascript
async processMessage(parsedData) {
  try {
    // ... 現有的 1-3 步驟 ...

    // 4. 調用 LLM 做決策
    const decision = await this.makeDecision(context);

    // 新增：檢查是否使用工具
    if (decision.action?.type === 'use_tool') {
      const toolName = decision.action.tool_name;
      const tool = await this.toolManager.getToolByName(toolName);

      if (tool) {
        // 檢查前置條件
        const canUse = await this.toolManager.checkPreconditions(tool, parsedData);

        if (canUse) {
          console.log(`🔧 AI decided to use tool: ${toolName}`);

          // 返回工具執行指令給前端
          return {
            action: {
              type: 'execute_tool',
              tool: {
                id: tool.id,
                name: tool.name,
                description: tool.description,
                steps: JSON.parse(tool.steps)
              }
            },
            reasoning: decision.reasoning
          };
        } else {
          console.log(`⚠️ Tool ${toolName} preconditions not met`);
          // 改為等待動作
          decision.action = { type: 'wait' };
          decision.reasoning = `Wanted to use ${toolName} but conditions not met. ${decision.reasoning}`;
        }
      }
    }

    // ... 現有的 5-7 步驟 ...
  }
}
```

### 步驟 5：前端工具執行框架

**檔案：** `ui-admin/src/Agent.js`

新增工具執行狀態和方法：

```javascript
class Agent {
  constructor(gridEngine, fieldMapTileMap, agent_id, bedPosition = { x: 3, y: 3 }, onAILog = null) {
    // ... 現有屬性 ...
    this.isExecutingTool = false; // 新增：工具執行標記
  }

  initializeServerListener() {
    this.socket.addEventListener('message', (event) => {
      const res = JSON.parse(event.data);

      // ... 現有處理 ...

      // 新增：處理工具執行
      if (res.type === 'nextMove' && res.data.action.type === 'execute_tool') {
        console.log(`🔧 Executing tool: ${res.data.action.tool.name}`);
        this.isExecutingTool = true;
        this.executeTool(res.data.action.tool);
        return;
      }

      if (res.type === 'nextMove') {
        // ... 現有邏輯 ...
      }
    });
  }

  // 新增：執行工具
  async executeTool(tool) {
    console.log(`Tool: ${tool.description}`);
    const results = [];

    try {
      for (let i = 0; i < tool.steps.length; i++) {
        const step = tool.steps[i];
        console.log(`  Step ${i+1}/${tool.steps.length}: ${step.description}`);

        const result = await this.executeToolStep(step, results);
        results.push(result);
      }

      console.log('✅ Tool execution completed');

      // 通知後端工具執行成功
      this.socket.send(JSON.stringify({
        type: 'tool_completed',
        agent_id: this.agent_id,
        tool_id: tool.id,
        success: true
      }));

    } catch (error) {
      console.error(`❌ Tool execution failed: ${error.message}`);

      // 通知後端工具執行失敗
      this.socket.send(JSON.stringify({
        type: 'tool_completed',
        agent_id: this.agent_id,
        tool_id: tool.id,
        success: false,
        error: error.message
      }));
    } finally {
      this.isExecutingTool = false;
      this.nextMove(); // 恢復正常循環
    }
  }

  // 新增：執行單一工具步驟
  async executeToolStep(step, previousResults) {
    switch (step.type) {
      case 'find_location':
        // 床位置已知，直接返回
        return {
          success: true,
          data: { location: this.bedPosition }
        };

      case 'navigate':
        const targetX = step.params.useResult !== undefined
          ? previousResults[step.params.useResult].data.location.x
          : step.params.x;
        const targetY = step.params.useResult !== undefined
          ? previousResults[step.params.useResult].data.location.y
          : step.params.y;

        await this.navigateAndWait(targetX, targetY, step.params.timeout || 30000);
        return {
          success: true,
          data: { arrivedAt: { x: targetX, y: targetY } }
        };

      case 'action':
        if (step.params.actionType === 'sleep') {
          const pos = this.getCharacterPosition();
          if (pos.x === this.bedPosition.x && pos.y === this.bedPosition.y) {
            this.sleepiness = 0;
            console.log('💤 Sleeping and recovering...');
          } else {
            throw new Error('Cannot sleep: not at bed location');
          }
        } else if (step.params.actionType === 'move') {
          this.moveAndCheckCollision(step.params.actionData.direction, this.fieldMapTileMap);
          await this.wait(500);
        }
        return { success: true };

      case 'wait':
        await this.wait(step.params.duration || 2000);
        return { success: true };

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  // 新增：導航並等待完成
  navigateAndWait(x, y, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const currentPos = this.getCharacterPosition();

      // 已在目標位置
      if (currentPos.x === x && currentPos.y === y) {
        resolve();
        return;
      }

      this.gridEngine.moveTo(this.agent_id, { x, y });

      let subscription;
      const timeoutId = setTimeout(() => {
        if (subscription) subscription.unsubscribe();
        reject(new Error(`Navigation timeout: couldn't reach (${x}, ${y})`));
      }, timeout);

      subscription = this.gridEngine.movementStopped().subscribe(() => {
        clearTimeout(timeoutId);
        subscription.unsubscribe();

        // 檢查是否真的到達
        const finalPos = this.getCharacterPosition();
        if (finalPos.x === x && finalPos.y === y) {
          resolve();
        } else {
          reject(new Error(`Navigation failed: stopped at (${finalPos.x}, ${finalPos.y}) instead of (${x}, ${y})`));
        }
      });
    });
  }

  // 新增：等待輔助方法
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  nextMove() {
    // 新增：工具執行期間暫停 AI 輪詢
    if (this.isExecutingTool) {
      console.log('⏸️ Tool execution in progress, skipping AI poll');
      return;
    }

    // ... 現有邏輯 ...
  }
}
```

### 步驟 6：後端處理工具完成通知

**檔案：** `agent/index.js`

新增工具完成訊息處理：

```javascript
else if (parsedData.type === 'tool_completed') {
  const agentId = parsedData.agent_id;
  const toolId = parsedData.tool_id;
  const success = parsedData.success;

  if (agents[agentId] && agents[agentId].toolManager) {
    // 更新工具統計
    await agents[agentId].toolManager.updateToolStats(toolId, success);

    if (success) {
      console.log(`✓ Tool ${toolId} executed successfully`);
    } else {
      console.log(`✗ Tool ${toolId} failed: ${parsedData.error}`);
    }
  }
}
```

### 步驟 7：優化 ToolManager 前置條件檢查

**檔案：** `agent/ToolManager.js`

確保 `location_known` 前置條件正確檢查：

```javascript
async checkPreconditions(tool, currentState) {
  const preconditions = JSON.parse(tool.preconditions || '[]');

  for (const condition of preconditions) {
    switch (condition.type) {
      case 'state_check':
        // ... 現有邏輯 ...
        break;

      case 'location_known':
        // 檢查資源位置是否已記錄
        const location = await this.memoryManager.findResourceLocation(condition.resource);
        if (!location) {
          console.log(`⚠️ Location for ${condition.resource} not known`);
          return false;
        }
        break;

      // ... 其他條件 ...
    }
  }

  return true;
}
```

## 關鍵技術點

### 1. 暫停 AI 輪詢的三層機制

```
前端: isExecutingTool = true
  ↓
前端: nextMove() 提前返回
  ↓
後端: 不接收 requestNextMove
  ↓
OpenAI: 不調用 API
```

### 2. 工具執行流程

```
AI 決策 → 選擇 use_tool
  ↓
後端檢查前置條件
  ↓
返回 execute_tool 指令給前端
  ↓
前端執行工具步驟：
  - find_location (返回 bedPosition)
  - navigate (moveTo + 等待 movementStopped)
  - action:sleep (檢查位置 + sleepiness = 0)
  - wait (延遲 2 秒)
  ↓
發送 tool_completed
  ↓
更新工具統計
  ↓
恢復 AI 輪詢
```

### 3. 床位置記錄機制

```
Agent 移動到床位置
  ↓
nextMove() 檢測位置 === bedPosition
  ↓
發送 record_location 訊息
  ↓
MemoryManager.recordLocation(x, y, 'bed', {bed: true})
  ↓
explored_locations 表插入/更新記錄
```

## 測試計畫

### 1. 床位置記錄測試
- Agent 移動到 (6, 5) → 檢查 explored_locations 表是否有記錄
- 重複經過床位置 → 檢查 visit_count 是否增加

### 2. 工具執行測試
- sleepiness 增加到 6-7 → 觀察 AI 是否選擇使用 goto_bed 工具
- 工具執行期間 → 驗證不發起新的 OpenAI 請求
- 導航到床 → 檢查是否成功到達 (6, 5)
- 睡眠動作 → 驗證 sleepiness 重置為 0

### 3. 失敗場景測試
- 床位置未記錄 → AI 不應該能使用 goto_bed（前置條件失敗）
- 導航被阻擋/超時 → 驗證錯誤處理，恢復 AI 控制
- 工具執行期間斷線 → 狀態重置

## 需修改的檔案清單

1. **agent/index.js** - WebSocket 訊息處理，初始化工具系統
2. **agent/ServerAgent.js** - AI 決策整合工具建議
3. **agent/ToolManager.js** - 優化前置條件檢查
4. **ui-admin/src/Agent.js** - 床位置記錄、工具執行框架
5. **agent/tools/presets.json** - 已存在，無需修改

## 完成標準

- ✅ Agent 經過床時自動記錄位置
- ✅ AI 可以決定使用 goto_bed 工具
- ✅ 工具執行期間暫停 OpenAI API 調用
- ✅ 成功導航到床並執行睡眠
- ✅ sleepiness 重置為 0
- ✅ 失敗時恢復 AI 控制
