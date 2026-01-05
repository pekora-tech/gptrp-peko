# AgentConfigPanel 修改摘要

## 🎯 修改目標

1. **自動偵測現有 Agent** - 無需手動輸入 Agent ID
2. **預設使用 Ollama** - 避免每次啟動都燒 OpenAI 的錢
3. **編輯模式** - 直接編輯現有 Agent 配置而非創建新的

## 📝 修改內容

### 前端修改

#### 1. AgentConfigPanel.js
**路徑**: `ui-admin/src/AgentConfigPanel.js`

**主要變更**：
- ✅ 添加 `useEffect` hook 自動載入現有 Agent 配置
- ✅ 預設 Agent ID 為 `agent1`（系統預設的 Agent）
- ✅ 預設 LLM Provider 改為 `ollama`
- ✅ 預設模型改為 `gemma3:4b`（速度快且免費）
- ✅ Agent ID 欄位改為不可編輯（鎖定狀態）
- ✅ 添加 Ollama 模型下拉選單（gemma3:4b, gemma3:12b, llama3.2 等）
- ✅ 更新提交邏輯：使用 `update_agent_config` 而非創建新 Agent
- ✅ 添加中文提示和使用建議
- ✅ 模板預設也改為使用 Ollama

**新增功能**：
```javascript
// 自動載入現有配置
useEffect(() => {
  const ws = new WebSocket('ws://localhost:8080');
  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: 'get_agent_config',
      agent_id: 'agent1'
    }));
  };
  // ...
}, [selectedAgent]);
```

**UI 改進**：
- Agent ID 顯示為灰色不可編輯狀態
- LLM Provider 選項添加中文說明（推薦、免費、會花錢等）
- 添加 Ollama 使用提示（需要先啟動服務）
- 底部添加使用提示區塊

### 後端修改

#### 2. agent/index.js
**路徑**: `agent/index.js`

**新增消息處理**：
```javascript
// 新增 get_agent_config 處理
else if (parsedData.type === 'get_agent_config') {
  const agentId = parsedData.agent_id;
  const config = configManager.getConfig(agentId);

  ws.send(JSON.stringify({
    type: 'agent_config',
    success: true,
    agent_id: agentId,
    config: config
  }));
}
```

**位置**: 在 `update_agent_config` 之前插入（第 252-282 行）

## 🔄 工作流程

### 舊流程（修改前）
1. 用戶打開配置面板
2. 需要手動輸入 Agent ID
3. 預設使用 OpenAI（會燒錢）
4. 提交後創建新 Agent
5. 需要刷新頁面才能看到效果

### 新流程（修改後）
1. 用戶打開配置面板
2. **自動偵測** `agent1` 並載入其配置
3. Agent ID 鎖定為 `agent1`（當前運行的 Agent）
4. **預設使用 Ollama**（免費）
5. 修改配置後點擊 "更新配置"
6. **即時更新**現有 Agent，下次決策時生效
7. 無需刷新頁面

## 📊 預設值變更對比

| 項目 | 修改前 | 修改後 | 原因 |
|------|--------|--------|------|
| Agent ID | 空白（需手動輸入） | `agent1`（自動填入） | 簡化使用流程 |
| LLM Provider | `openai` | `ollama` | 避免燒錢 |
| Model | `gpt-5-mini` | `gemma3:4b` | 免費且速度快 |
| Agent ID 可編輯性 | 可編輯 | 鎖定不可編輯 | 防止誤操作 |
| 提交行為 | 創建新 Agent | 更新現有 Agent | 符合實際使用場景 |

## ✅ 測試檢查清單

### 前端測試
- [ ] 打開配置面板時自動載入 `agent1` 配置
- [ ] Agent ID 欄位顯示為灰色且無法編輯
- [ ] LLM Provider 預設選中 "Ollama (Local - 推薦，免費)"
- [ ] Ollama 模型下拉選單顯示 4 個選項
- [ ] 選擇 OpenAI 時顯示 API Key 輸入框
- [ ] 滑塊可以正常調整各項參數
- [ ] 點擊模板可以快速套用預設值
- [ ] 提交時顯示成功/失敗提示

### 後端測試
- [ ] `get_agent_config` 消息正確返回配置
- [ ] `update_agent_config` 正確更新配置
- [ ] 更新配置後 Agent 使用新的 LLM Provider
- [ ] Ollama Provider 健康檢查通過
- [ ] 配置保存到數據庫

### 整合測試
- [ ] 修改配置後 Agent 在下次決策時使用新配置
- [ ] 切換 Provider（OpenAI ↔ Ollama）正常工作
- [ ] 修改個性參數後 Agent 行為有變化
- [ ] Console 日誌正確顯示 Provider 類型

## 🚨 注意事項

### 使用 Ollama 前的準備
1. 安裝 Ollama：`curl https://ollama.ai/install.sh | sh`
2. 啟動服務：`ollama serve`
3. 拉取模型：`ollama pull gemma3:4b`

### 已知限制
- 當前只支援編輯 `agent1`，未來可擴展為支援多個 Agent
- 修改配置後需要等待 Agent 完成當前動作才會使用新配置
- Ollama 需要手動啟動服務，未提供自動啟動功能

## 📚 相關文件

- **使用指南**: [AGENT_CONFIG_GUIDE.md](./AGENT_CONFIG_GUIDE.md)
- **系統架構**: [logical-foraging-lake.md](./logical-foraging-lake.md)
- **專案說明**: [readme.md](./readme.md)

## 🎉 優點

1. **使用更簡單** - 自動偵測 Agent，無需手動輸入 ID
2. **預設省錢** - 使用 Ollama 替代 OpenAI
3. **即時生效** - 修改配置後立即更新，無需重啟
4. **防呆設計** - Agent ID 鎖定，避免誤創建多個 Agent
5. **中文友善** - 添加中文提示和使用建議

## 📈 下一步建議

1. 添加多 Agent 支援（下拉選單選擇不同 Agent）
2. 添加 "重置為預設值" 按鈕
3. 添加 "匯出/匯入配置" 功能
4. 添加 Ollama 服務狀態偵測
5. 添加配置變更歷史記錄
