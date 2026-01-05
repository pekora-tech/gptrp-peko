# 架構變更說明：從自動執行到 AI 輔助決策

## 問題

原本的設計是讓 BehaviorExecutor 自動執行工具的所有步驟，但這導致了一個問題：

```
🔧 Executing tool: goto_bed
  Step 1/4: Find bed location from memory
  Step 2/4: Navigate to bed location
  sendAction not available, simulating navigation success  ❌ 問題：沒有真正發送動作
  Step 3/4: Execute sleep action
  sendAction not available, simulating action success  ❌ 問題：沒有真正執行
```

**核心問題**：工具執行系統（BehaviorExecutor）與前端通信脫節，無法真正發送動作給前端。

## 解決方案

改變架構：**工具不自動執行，而是作為建議提供給 AI，由 AI 決策並返回相應動作**。

### 新的工作流程

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 狀態檢測                                                  │
│    sleepiness > 7                                           │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. 工具建議                                                  │
│    ToolManager.suggestTool()                                │
│    → goto_bed (confidence: 0.95)                           │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. 注入 Prompt                                              │
│    建議添加到 AI 的 prompt 中：                             │
│    - Tool: goto_bed                                        │
│    - Reason: High sleepiness                               │
│    - How to use: navigate → sleep                          │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. AI 決策                                                  │
│    AI 看到：                                                │
│    - Sleepiness: 8/10 (很高)                               │
│    - Tool suggestion: goto_bed                             │
│    - Bed location in memory                                │
│    決定：使用 goto_bed                                      │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. 返回動作                                                  │
│    AI 返回：                                                │
│    {                                                        │
│      "action": {                                           │
│        "type": "navigate",                                 │
│        "x": 6,                                             │
│        "y": 5                                              │
│      },                                                    │
│      "reasoning": "I'm very tired, need to go to bed"     │
│    }                                                       │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. 前端執行                                                  │
│    前端收到 navigate 指令 → 開始移動                        │
│    到達床位置後，下次決策：                                 │
│    AI 返回 sleep 動作 → 執行睡眠 → sleepiness = 0         │
└─────────────────────────────────────────────────────────────┘
```

## 優勢

### 1. **解耦合**
- 工具系統不需要直接訪問 WebSocket
- AI 負責所有的動作決策
- 前端正常接收和執行動作

### 2. **智能決策**
- AI 可以根據上下文靈活使用工具
- 不是硬編碼的自動執行
- AI 可以選擇是否使用工具建議

### 3. **可觀察性**
- 可以在 AI Console 看到 AI 的推理過程
- 可以看到 AI 如何理解和使用工具建議
- TaskManager 顯示完整的決策流程

### 4. **可擴展性**
- 容易添加新工具
- 只需定義工具建議邏輯
- AI 會自動理解如何使用新工具

## 代碼變更

### ServerAgent.js

**之前**（自動執行）：
```javascript
const toolResult = await this.behaviorExecutor.executeTool(tool, context);
if (toolResult.success) {
  return { action: { type: 'wait' }, ... };
}
```

**現在**（建議模式）：
```javascript
const suggestedTool = this.toolManager.suggestTool(parsedData);
if (suggestedTool) {
  context.suggestedTool = suggestedTool; // 添加到 AI 上下文
}
const decision = await this.makeDecision(context); // AI 決策
```

### Prompt 變更

**新增工具建議部分**：
```markdown
# 🔧 Tool Recommendation
**Suggested Tool**: goto_bed
**Confidence**: 95%
**Reason**: High sleepiness (8/10) matches goto_bed preconditions

You have a high-priority tool recommendation! Consider using it:
- For goto_bed: Use "navigate" action to go to bed location, then "sleep" action when you arrive
- The bed location is stored in your memory at the coordinates you've visited before
```

## 任務流程

### TaskManager 顯示

1. **Pending（建議）**
   ```
   ⏳ Suggested: goto_bed - High sleepiness (8/10) matches goto_bed preconditions
   Tool: goto_bed
   ```

2. **In Progress（使用中）**
   ```
   🔄 AI using tool: goto_bed
   Tool: goto_bed
   Action: navigate to (6, 5)
   ```

3. **Completed（完成）**
   ```
   ✅ Successfully used goto_bed tool
   Tool: goto_bed
   Result: Sleepiness reduced to 0
   ```

## 測試驗證

### 檢查點

1. **工具建議觸發**
   - [ ] 後端日誌：`💡 Tool suggested: goto_bed`
   - [ ] TaskManager 顯示 pending 任務

2. **AI 理解建議**
   - [ ] AI Console 顯示 prompt 包含工具建議部分
   - [ ] AI 的 reasoning 提到需要睡覺

3. **AI 執行動作**
   - [ ] AI 返回 navigate 動作到床位置
   - [ ] 前端開始導航（可見移動動畫）

4. **完成流程**
   - [ ] 到達床位置
   - [ ] AI 返回 sleep 動作
   - [ ] sleepiness 降為 0
   - [ ] TaskManager 顯示 completed

## 未來擴展

### 添加新工具

只需兩步：

1. **定義工具建議邏輯**（ToolManager.js）：
   ```javascript
   if (currentState.hunger > 7) {
     return {
       name: 'find_food',
       confidence: 0.9,
       reason: 'High hunger level'
     };
   }
   ```

2. **在 Prompt 中說明用法**（ServerAgent.js）：
   ```javascript
   - For find_food: Use "navigate" to food location, then "eat" action
   ```

AI 會自動理解並使用新工具！

## 總結

這個架構變更將**自動化執行**改為**AI 輔助決策**，解決了工具執行與前端通信脫節的問題，同時提升了系統的智能性、可觀察性和可擴展性。
