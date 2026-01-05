# Agent 配置面板使用指南

## 🎯 快速開始

### 1. 啟動 Ollama（推薦，免費）

```bash
# 啟動 Ollama 服務
ollama serve

# 拉取推薦的模型（在另一個終端）
ollama pull gemma3:4b
```

### 2. 啟動遊戲

```bash
# 安裝依賴（如果還沒安裝）
npm install

# 啟動後端和前端
npm start
```

### 3. 打開配置面板

在遊戲界面中，點擊右側的 **"+ New Agent"** 按鈕打開配置面板。

## 🔧 配置面板功能

### 自動偵測現有 Agent

- 面板會自動偵測當前運行的 `agent1` 並載入其配置
- Agent ID 是鎖定的，無需手動輸入
- 所有修改都會即時更新到現有的 Agent

### LLM Provider 選擇

#### Ollama（推薦 - 免費）
- **預設選項**：避免每次啟動都燒 OpenAI 的錢
- **推薦模型**：
  - `gemma3:4b` - 速度快，適合大部分場景
  - `gemma3:12b` - 較慢但更聰明
  - `llama3.2:3b` - 快速輕量
  - `llama3.2:7b` - 平衡選擇

#### OpenAI（需要 API Key）
- 選擇此選項會使用 OpenAI API，**會產生費用**
- 需要輸入有效的 API Key
- 預設模型：`gpt-5-mini`

### 快速模板

選擇預設模板可以快速套用不同性格的 Agent：

- **Explorer**：勇敢的探索者，喜歡發現新地方（exploration: 90, bold: 85, curious: 90）
- **Collector**：謹慎的收集者，專注效率和安全（collection: 95, cautious: 80）
- **Social**：友善的社交者，重視人際互動（social: 95, curious: 70, bold: 60）
- **Balanced**：各方面平衡的 Agent（所有屬性: 50）

### 個性化設定

#### 行為傾向（Behavior Tendencies）
- **Exploration**（探索）：0-100，高值表示更愛探索未知區域
- **Collection**（收集）：0-100，高值表示更專注收集資源
- **Social**（社交）：0-100，高值表示更喜歡互動
- **Defensive**（防禦）：0-100，高值表示更注重安全

#### 性格特質（Traits）
- **Cautious**（謹慎）：0-100，高值表示更保守
- **Bold**（大膽）：0-100，高值表示更勇敢冒險
- **Curious**（好奇）：0-100，高值表示更愛探索
- **Lazy**（懶惰）：0-100，高值表示更傾向等待

### 記憶設定

- **Short-term Size**：短期記憶容量（5-100），預設 20
- **Long-term Threshold**：長期記憶重要性閾值（1-10），預設 7
- **Location Radius**：位置記憶搜索半徑（1-20），預設 5

## 💡 使用技巧

### 避免燒錢
1. **使用 Ollama 作為預設 Provider**
2. 確保 Ollama 服務正在運行：`ollama serve`
3. 只在需要更高智能時才切換到 OpenAI

### 調整 Agent 性格
1. 點擊 "+ New Agent" 打開配置面板
2. 選擇快速模板或手動調整滑塊
3. 點擊 "更新配置" 按鈕
4. Agent 會在下次決策時使用新配置

### 推薦配置

#### 探索者配置（省錢版）
```
LLM Provider: Ollama
Model: gemma3:4b
Exploration: 90
Bold: 85
Curious: 90
Cautious: 20
```

#### 收集者配置（省錢版）
```
LLM Provider: Ollama
Model: gemma3:4b
Collection: 95
Cautious: 80
Exploration: 30
Lazy: 30
```

## 🐛 常見問題

### Q: 為什麼我看不到配置面板？
A: 確保後端服務正在運行（`npm start`）並且前端已連接到 WebSocket。

### Q: 更新配置後為什麼沒有立即生效？
A: Agent 會在下次做決策時使用新配置。你可以等待當前動作完成。

### Q: Ollama 連接失敗怎麼辦？
A:
1. 確保 Ollama 服務正在運行：`ollama serve`
2. 檢查 Base URL 是否正確：`http://localhost:11434`
3. 確保已拉取模型：`ollama pull gemma3:4b`

### Q: 可以同時運行多個 Agent 嗎？
A: 目前系統支援多個 Agent，但配置面板預設只管理 `agent1`。未來版本會支援動態創建多個 Agent。

## 📊 配置示例

### 冒險型 Agent（Ollama）
```json
{
  "agentId": "agent1",
  "name": "Adventure Bot",
  "llmProvider": {
    "type": "ollama",
    "model": "gemma3:4b",
    "baseURL": "http://localhost:11434",
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
    }
  }
}
```

### 穩健型 Agent（Ollama）
```json
{
  "agentId": "agent1",
  "name": "Steady Bot",
  "llmProvider": {
    "type": "ollama",
    "model": "gemma3:4b",
    "baseURL": "http://localhost:11434",
    "temperature": 0.5
  },
  "personality": {
    "behaviorTendencies": {
      "exploration": 40,
      "collection": 80,
      "social": 30,
      "defensive": 70
    },
    "traits": {
      "cautious": 75,
      "bold": 30,
      "curious": 50,
      "lazy": 20
    }
  }
}
```

## 🚀 下一步

- 嘗試不同的模型和性格組合
- 觀察 AI Console 中的決策過程
- 根據 Agent 的表現調整配置
- 享受免費的 Ollama 體驗，不再燒錢！
