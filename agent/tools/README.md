# 工具系統使用指南

本文檔說明如何創建和管理 AI Agent 的自動化工具。

---

## 📚 目錄

1. [什麼是工具？](#什麼是工具)
2. [工具定義格式](#工具定義格式)
3. [如何添加新工具](#如何添加新工具)
4. [步驟類型說明](#步驟類型說明)
5. [實用範例](#實用範例)
6. [最佳實踐](#最佳實踐)

---

## 什麼是工具？

工具是預先定義的多步驟行為序列，讓 AI Agent 能夠：
- **零 API 成本**自動執行常見任務
- **避免重複思考**相同的行為模式
- **更快速**完成任務（無需每步都問 AI）

### 當前可用工具

| 工具名稱 | 類別 | 描述 |
|---------|------|------|
| `goto_bed` | survival | 導航到床並睡覺 |
| `explore_area` | exploration | 探索附近 4 個方向 |
| `plant_crops` | farming | 種植作物 |
| `random_walk` | exploration | 隨機移動探索 |

---

## 工具定義格式

每個工具都是一個 JSON 對象，包含以下字段：

```json
{
  "name": "tool_name",              // 唯一識別名稱（必須）
  "description": "What it does",    // 工具描述（必須）
  "category": "survival",           // 類別（必須）
  "version": "1.0.0",               // 版本號（可選）

  "preconditions": [                // 前置條件（可選）
    {
      "type": "state_check",        // 檢查類型
      "field": "sleepiness",        // 狀態字段
      "operator": ">",              // 比較運算符
      "value": 5                    // 目標值
    }
  ],

  "steps": [                        // 執行步驟（必須）
    {
      "type": "navigate",           // 步驟類型
      "description": "Go to bed",   // 步驟描述
      "params": { ... }             // 步驟參數
    }
  ],

  "expected_outcome": {             // 預期結果（可選）
    "description": "Sleepiness reduced",
    "state_changes": [...]
  },

  "created_by": "system"            // 創建者（可選）
}
```

---

## 如何添加新工具

### 方法 1: 編輯 presets.json（推薦）

1. 打開 `agent/tools/presets.json`
2. 在數組末尾添加新工具定義
3. 確保 JSON 格式正確（注意逗號）
4. 重啟 Agent 服務

**範例**：添加 "喝水" 工具

```json
{
  "name": "drink_water",
  "description": "Navigate to water source and drink",
  "category": "survival",
  "preconditions": [
    {
      "type": "state_check",
      "field": "thirst",
      "operator": ">",
      "value": 6
    }
  ],
  "steps": [
    {
      "type": "find_location",
      "description": "Find water source",
      "params": {
        "resource": "water"
      }
    },
    {
      "type": "navigate",
      "description": "Navigate to water",
      "params": {
        "useResult": 0,
        "timeout": 30000
      },
      "retryable": true
    },
    {
      "type": "action",
      "description": "Drink water",
      "params": {
        "actionType": "drink"
      }
    }
  ],
  "expected_outcome": {
    "description": "Thirst reduced to near zero"
  },
  "created_by": "system"
}
```

### 方法 2: 使用代碼動態創建

```javascript
import ToolManager from './ToolManager.js';
import DatabaseManager from './database.js';

const db = new DatabaseManager();
const toolManager = new ToolManager(db, 'your_agent_id');

// 定義工具
const newTool = {
  name: 'custom_tool',
  description: 'My custom behavior',
  category: 'custom',
  steps: [
    {
      type: 'action',
      description: 'Do something',
      params: { actionType: 'custom_action' }
    }
  ]
};

// 創建工具
const toolId = toolManager.createTool(newTool);
console.log(`Tool created with ID: ${toolId}`);
```

### 方法 3: 讓 AI 自動提議（Phase 2+）

未來 AI 會在運行過程中自動提議新工具，您只需審批即可。

---

## 步驟類型說明

### 1. `find_location` - 查找資源位置

從記憶中查找已知資源的位置。

```json
{
  "type": "find_location",
  "description": "Find bed location from memory",
  "params": {
    "resource": "bed"  // 資源類型：bed, water, tree, etc.
  }
}
```

**支援的資源類型**：
- `bed` - 床
- `water` - 水源
- `tree` - 樹木
- 任何在 `explored_locations` 表中記錄的資源

---

### 2. `navigate` - 導航到位置

自動尋路並移動到目標位置。

```json
{
  "type": "navigate",
  "description": "Navigate to target",
  "params": {
    "x": 10,           // 目標 X 坐標（可選）
    "y": 15,           // 目標 Y 坐標（可選）
    "useResult": 0,    // 使用前一個步驟的結果（可選）
    "timeout": 30000   // 超時時間（毫秒，默認 30000）
  },
  "retryable": true,   // 失敗時是否可重試
  "onFailure": "call_ai"  // 失敗時的處理方式
}
```

**參數說明**：
- `useResult`: 使用第 N 個步驟的結果作為目標（例如 `find_location` 的結果）
- `x, y`: 直接指定座標（與 `useResult` 二選一）
- `timeout`: 導航超時時間
- `retryable`: 是否允許重試（默認 false）
- `onFailure`: 失敗處理策略（`call_ai` 或 `ignore`）

---

### 3. `action` - 執行遊戲動作

執行特定的遊戲動作。

```json
{
  "type": "action",
  "description": "Execute sleep action",
  "params": {
    "actionType": "sleep",  // 動作類型
    "actionData": {         // 額外數據（可選）
      "direction": "up"
    }
  }
}
```

**支援的動作類型**：
- `sleep` - 睡覺
- `move` - 移動（需要 `actionData.direction`）
- `plant` - 種植
- `drink` - 喝水（未來）
- `harvest` - 收穫（未來）
- `chop` - 砍伐（未來）

---

### 4. `wait` - 等待

暫停執行指定時間。

```json
{
  "type": "wait",
  "description": "Wait for action to complete",
  "params": {
    "duration": 2000  // 等待時間（毫秒）
  }
}
```

---

### 5. `check_state` - 檢查狀態

驗證當前狀態是否滿足條件。

```json
{
  "type": "check_state",
  "description": "Verify sleepiness reduced",
  "params": {
    "condition": {
      "type": "state_check",
      "field": "sleepiness",
      "operator": "<",
      "value": 3
    }
  },
  "optional": true  // 是否為可選檢查
}
```

---

## 實用範例

### 範例 1: 複合行為 - 累了又渴

```json
{
  "name": "tired_and_thirsty",
  "description": "Drink water then go to sleep",
  "category": "survival",
  "preconditions": [
    { "type": "state_check", "field": "sleepiness", "operator": ">", "value": 6 },
    { "type": "state_check", "field": "thirst", "operator": ">", "value": 6 }
  ],
  "steps": [
    {
      "type": "find_location",
      "description": "Find water source",
      "params": { "resource": "water" }
    },
    {
      "type": "navigate",
      "description": "Go to water",
      "params": { "useResult": 0 },
      "retryable": true
    },
    {
      "type": "action",
      "description": "Drink water",
      "params": { "actionType": "drink" }
    },
    {
      "type": "find_location",
      "description": "Find bed",
      "params": { "resource": "bed" }
    },
    {
      "type": "navigate",
      "description": "Go to bed",
      "params": { "useResult": 3 },
      "retryable": true
    },
    {
      "type": "action",
      "description": "Sleep",
      "params": { "actionType": "sleep" }
    }
  ],
  "expected_outcome": {
    "description": "Both thirst and sleepiness reduced"
  }
}
```

---

### 範例 2: 循環探索

```json
{
  "name": "explore_spiral",
  "description": "Explore in a spiral pattern",
  "category": "exploration",
  "steps": [
    {
      "type": "action",
      "description": "Move up",
      "params": { "actionType": "move", "actionData": { "direction": "up" } }
    },
    {
      "type": "action",
      "description": "Move right",
      "params": { "actionType": "move", "actionData": { "direction": "right" } }
    },
    {
      "type": "action",
      "description": "Move right again",
      "params": { "actionType": "move", "actionData": { "direction": "right" } }
    },
    {
      "type": "action",
      "description": "Move down",
      "params": { "actionType": "move", "actionData": { "direction": "down" } }
    },
    {
      "type": "action",
      "description": "Move down again",
      "params": { "actionType": "move", "actionData": { "direction": "down" } }
    }
  ]
}
```

---

### 範例 3: 資源收集

```json
{
  "name": "harvest_nearby_resources",
  "description": "Harvest resources in adjacent tiles",
  "category": "resource_gathering",
  "steps": [
    {
      "type": "action",
      "description": "Check current tile",
      "params": { "actionType": "harvest" }
    },
    {
      "type": "action",
      "description": "Move to next tile",
      "params": { "actionType": "move", "actionData": { "direction": "right" } }
    },
    {
      "type": "action",
      "description": "Harvest again",
      "params": { "actionType": "harvest" }
    },
    {
      "type": "action",
      "description": "Return",
      "params": { "actionType": "move", "actionData": { "direction": "left" } }
    }
  ]
}
```

---

## 最佳實踐

### ✅ 做什麼

1. **明確的工具名稱**：使用描述性名稱（如 `goto_bed` 而非 `tool1`）
2. **合理的前置條件**：確保工具只在適當時候使用
3. **錯誤處理**：對可能失敗的步驟設置 `retryable` 和 `onFailure`
4. **詳細描述**：每個步驟都有清晰的描述
5. **測試**：創建工具後運行測試驗證

### ❌ 避免什麼

1. **過於複雜**：單個工具不應超過 10 個步驟
2. **死循環**：確保不會創建無限循環
3. **重複工具**：檢查是否已有相似工具
4. **硬編碼座標**：盡量使用 `find_location` 而非固定座標
5. **忽略前置條件**：缺少前置條件可能導致工具在不適當時執行

---

## 工具類別建議

- **survival**: 生存相關（睡覺、喝水、吃東西）
- **exploration**: 探索相關（移動、發現新區域）
- **farming**: 農業相關（種植、收穫）
- **resource_gathering**: 資源收集（砍樹、採礦）
- **building**: 建造相關（未來）
- **social**: 社交相關（未來，與 NPC 互動）
- **combat**: 戰鬥相關（未來）

---

## 載入工具到系統

### 自動載入（伺服器啟動時）

工具會在 Agent 初始化時自動載入：

```javascript
import ToolManager from './ToolManager.js';
import fs from 'fs';

const toolManager = new ToolManager(db, agentId);
const presets = JSON.parse(fs.readFileSync('./tools/presets.json', 'utf-8'));

toolManager.loadPresetTools(presets);
// ✓ 工具已載入！
```

### 手動載入（測試）

```javascript
const newTool = { /* 工具定義 */ };
const toolId = toolManager.createTool(newTool);
```

---

## 查看已載入的工具

```javascript
const tools = toolManager.getAvailableToolsForPrompt(currentState);

console.log(tools);
// {
//   survival: [
//     { name: 'goto_bed', description: '...', reliability: '95%' }
//   ],
//   exploration: [...]
// }
```

---

## 下一步

- 📖 查看計劃文檔了解 Phase 2-3 功能
- 🧪 運行 `node test-tools.js` 測試工具系統
- 🤖 等待 AI 自動提議新工具（Phase 2）
- 🎓 啟用 Skilling 模式讓 AI 自主學習（Phase 4）

---

**有問題？** 查看主計劃文檔或測試腳本示例。
