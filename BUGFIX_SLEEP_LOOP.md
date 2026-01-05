# 修復：Sleep 後任務持續循環問題

## 🐛 問題描述

系統成功建議了 goto_bed 工具，但任務永遠停留在 TODO 列表中，持續顯示建議：

```
TODO (19)
⏳ 睡覺
16:22

⏳ Suggested: goto_bed - High sleepiness (8) matches goto_bed preconditions
16:22 Tool: goto_bed
```

**問題原因**：
1. ❌ AI 執行 sleep 後，sleepiness 被重置為 0
2. ❌ 但 `nextMove()` 立即調用 `increaseSleepiness()`，sleepiness 變回 1
3. ❌ 後端下次收到的 sleepiness 永遠不是 0
4. ❌ 系統認為還需要睡覺，持續建議 goto_bed
5. ❌ 任務從未完成，一直在 TODO 中

## 🔧 根本原因

### 前端 Agent.js 的執行流程：

```javascript
// 1. AI 決定 sleep
case 'sleep':
  this.sleepiness = 0;  // ✅ 重置為 0
  this.nextMove();      // ❌ 立即調用 nextMove
  break;

// 2. nextMove() 中
nextMove() {
  this.increaseSleepiness();  // ❌ sleepiness 變成 1
  this.socket.send({
    sleepiness: this.sleepiness  // 發送 sleepiness = 1
  });
}

// 3. 後端收到
sleepiness: 1  // ❌ 永遠看不到 0，系統認為還需要睡覺
```

## ✅ 解決方案

### 1. 添加 `justSlept` 標記

在 sleep 成功後，跳過一次 sleepiness 增加：

**ui-admin/src/Agent.js**:
```javascript
case 'sleep':
  const { x, y } = this.getCharacterPosition();
  if(x === this.bedPosition.x && y === this.bedPosition.y) {
    this.sleepiness = 0;
    console.log(`✅ ${this.agent_id} slept successfully, sleepiness reset to 0`);

    // 通知後端 sleep 成功
    this.socket.send(JSON.stringify({
      type: 'sleep_completed',
      agent_id: this.agent_id,
      position: { x, y }
    }));

    // 標記剛剛睡過，跳過下次 sleepiness 增加
    this.justSlept = true;
  }
  this.nextMove();
  break;
```

### 2. 修改 nextMove() 邏輯

只在沒有剛睡過時才增加 sleepiness：

```javascript
nextMove() {
  const characterPosition = this.getCharacterPosition();
  const surroundings = this.getSurroundings();

  // 只在沒有剛睡過覺時才增加 sleepiness
  if (!this.justSlept) {
    this.increaseSleepiness();
  } else {
    // 重置標記
    this.justSlept = false;
  }

  this.socket.send(
    JSON.stringify({
      type: 'requestNextMove',
      agent_id: this.agent_id,
      position: characterPosition,
      surroundings: surroundings,
      sleepiness: this.sleepiness  // 現在是 0！
    })
  );
}
```

### 3. 後端處理 sleep_completed 事件

當收到 sleep 完成通知時，發送任務完成事件：

**agent/index.js**:
```javascript
else if (parsedData.type === 'sleep_completed') {
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
```

## 📊 新的執行流程

```
1. sleepiness = 8
   ↓
2. 系統建議 goto_bed → TaskManager: TODO (pending)
   ↓
3. AI 決定 navigate 到床 (6, 5)
   ↓
4. 到達床位置
   ↓
5. AI 決定 sleep
   ↓
6. 前端執行 sleep:
   - sleepiness = 0
   - justSlept = true
   - 發送 sleep_completed 到後端
   ↓
7. nextMove():
   - 檢測到 justSlept = true
   - 跳過 increaseSleepiness()
   - justSlept = false
   - 發送 sleepiness = 0 給後端 ✅
   ↓
8. 後端收到 sleep_completed:
   - 發送 task_update (completed)
   - TaskManager: TODO → DONE ✅
   ↓
9. 後端收到 sleepiness = 0:
   - 不再建議 goto_bed ✅
   - AI 恢復正常活動
```

## 🎯 預期結果

### 修復前：
```
❌ TODO 列表持續顯示：
⏳ Suggested: goto_bed
⏳ Suggested: goto_bed
⏳ Suggested: goto_bed
(永遠不完成)
```

### 修復後：
```
✅ TODO 列表顯示任務流程：
⏳ Suggested: goto_bed (16:22)
🔄 AI using tool: goto_bed (16:23)
✅ Successfully completed goto_bed (16:24)

✅ 任務移動到 DONE 列表
✅ Agent 恢復正常探索
✅ sleepiness 從 0 開始重新累積
```

## 🧪 測試驗證

### 檢查點：

1. **Sleep 執行**
   - [ ] 前端日誌：`✅ agent1 slept successfully, sleepiness reset to 0`
   - [ ] 後端日誌：`😴 Agent agent1 completed sleep at (6, 5)`

2. **Sleepiness 正確傳遞**
   - [ ] Sleep 後第一次 requestNextMove 的 sleepiness = 0
   - [ ] 後端不再建議 goto_bed（因為 sleepiness = 0）

3. **任務狀態更新**
   - [ ] TaskManager 收到 completed 狀態
   - [ ] 任務從 TODO 移動到 DONE
   - [ ] DONE 列表顯示：`✅ Successfully completed goto_bed: slept and rested`

4. **正常恢復**
   - [ ] Agent 繼續探索
   - [ ] Sleepiness 從 0 開始累積
   - [ ] 當 sleepiness > 7 時，再次觸發 goto_bed 建議

## 📁 修改的文件

1. **ui-admin/src/Agent.js**
   - 添加 `justSlept` 標記
   - 修改 sleep case：通知後端 + 設置標記
   - 修改 nextMove()：條件性增加 sleepiness

2. **agent/index.js**
   - 添加 `sleep_completed` 事件處理
   - 發送任務完成通知

## 💡 關鍵洞察

這個 bug 揭示了一個重要的設計問題：

**前端和後端的狀態同步**
- 前端維護 sleepiness 狀態
- 後端基於收到的 sleepiness 做決策
- 如果前端狀態變化沒有正確反映到後端，會導致決策循環

**解決方案**：
1. 添加狀態變化的通知機制（sleep_completed）
2. 確保狀態變化在下次通信前不被覆蓋（justSlept 標記）
3. 顯式的任務完成通知（task_update completed）

## 🎉 修復完成

現在系統可以正確地：
- ✅ 建議 goto_bed 工具
- ✅ AI 決策並執行 navigate + sleep
- ✅ Sleep 成功後重置 sleepiness
- ✅ 正確傳遞 sleepiness = 0 給後端
- ✅ 完成任務並移動到 DONE 列表
- ✅ 停止重複建議 goto_bed
- ✅ Agent 恢復正常活動

重啟服務後，整個 goto_bed 流程應該能夠完整地執行並完成！🚀
