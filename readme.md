# 🎮 GPTRPG - AI 驅動的 RPG 遊戲環境

<div align="center">

![遊戲地圖](map.png)

**一個由大型語言模型 (LLM) 驅動的智能 AI 代理生存模擬遊戲**

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node Version](https://img.shields.io/badge/node-16.19.0-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18.1.0-61dafb.svg)](https://reactjs.org/)
[![Phaser](https://img.shields.io/badge/Phaser-3.55.2-blueviolet.svg)](https://phaser.io/)

</div>

---

## 📋 目錄

- [專案簡介](#-專案簡介)
- [核心特性](#-核心特性)
- [系統架構](#-系統架構)
- [快速開始](#-快速開始)
- [專案結構](#-專案結構)
- [技術細節](#-技術細節)
- [AI 代理運作原理](#-ai-代理運作原理)
- [遊戲操作](#-遊戲操作)
- [開發路線圖](#-開發路線圖)
- [常見問題](#-常見問題)
- [授權條款](#-授權條款)

---

## 🌟 專案簡介

GPTRPG 是一個創新的概念驗證專案，結合了以下兩大核心元素：

1. **🗺️ RPG 風格遊戲環境** - 一個由 LLM 驅動的 AI 代理可以自由探索和互動的 2D 世界
2. **🤖 智能 AI 代理** - 連接 OpenAI API 並能在環境中自主生存的 AI 代理

AI 代理會根據周圍環境、內部狀態（如睡意、飢餓等）自主做出決策，模擬真實生物的生存行為。

---

## ✨ 核心特性

### 🎯 遊戲環境
- ✅ **基於 Phaser 的遊戲引擎** - 流暢的 2D 渲染體驗
- ✅ **Grid Engine 網格系統** - 精確的角色移動與碰撞檢測
- ✅ **Tiled 地圖編輯器** - 可視化的地圖設計與編輯
- ✅ **植物種植系統** - 可種植圖塊、植物生長機制
- ✅ **不可通行區域** - 真實的地形碰撞系統
- ✅ **自由視角切換** - 玩家視角 / 上帝視角

### 🧠 AI 代理系統
- ✅ **GPT 驅動決策** - 使用 OpenAI API 進行智能決策
- ✅ **環境感知能力** - 感知位置、周圍物體、地形資訊
- ✅ **內部狀態系統** - 追蹤睡意、飢餓、口渴等生理狀態
- ✅ **自主行動能力** - 移動、等待、導航、睡眠等基礎動作
- ✅ **WebSocket 即時通訊** - 前後端即時雙向溝通
- ✅ **多代理架構支援** - 可同時運行多個獨立 AI 代理

---

## 🏗️ 系統架構

```
┌─────────────────────────────────────────────────────────────┐
│                        GPTRPG 系統                           │
├─────────────────────────┬───────────────────────────────────┤
│                         │                                   │
│    前端 (ui-admin)      │      後端 (agent)                 │
│                         │                                   │
│  ┌──────────────────┐   │   ┌──────────────────┐            │
│  │  React App       │   │   │  WebSocket       │            │
│  │  (Port 3000)     │◄──┼──►│  Server          │            │
│  └──────────────────┘   │   │  (Port 8080)     │            │
│           │              │   └────────┬─────────┘            │
│           ▼              │            │                      │
│  ┌──────────────────┐   │            ▼                      │
│  │  Phaser Engine   │   │   ┌──────────────────┐            │
│  │  + Grid Engine   │   │   │  ServerAgent     │            │
│  └──────────────────┘   │   │  管理系統        │            │
│           │              │   └────────┬─────────┘            │
│           ▼              │            │                      │
│  ┌──────────────────┐   │            ▼                      │
│  │  Tiled Map       │   │   ┌──────────────────┐            │
│  │  Renderer        │   │   │  OpenAI API      │            │
│  └──────────────────┘   │   │  (GPT-3.5/5)     │            │
│                         │   └──────────────────┘            │
└─────────────────────────┴───────────────────────────────────┘
```

---

## 🚀 快速開始

### 📋 環境需求

- **Node.js**: `16.19.0` （強烈建議使用此版本）
- **npm**: `8.x` 或更高版本
- **OpenAI API Key**: 需要有效的 OpenAI API 金鑰

### 📥 安裝步驟

#### 1️⃣ 克隆專案

```bash
git clone https://github.com/your-username/gptrpg.git
cd gptrpg
```

#### 2️⃣ 配置 OpenAI API Key

編輯 `agent/env.json` 檔案，填入你的 OpenAI API 金鑰：

```json
{
  "OPENAI_API_KEY": "sk-your-api-key-here"
}
```

> ⚠️ **安全提醒**: 請勿將 API 金鑰提交到版本控制系統！建議將 `env.json` 加入 `.gitignore`

#### 3️⃣ 安裝依賴

```bash
npm install
```

這個命令會自動安裝根目錄、`agent` 和 `ui-admin` 三個子專案的所有依賴。

#### 4️⃣ 啟動專案

```bash
npm start
```

這會同時啟動：
- **AI 代理伺服器** (Port 8080)
- **React 前端應用** (Port 3000)

#### 5️⃣ 開啟遊戲

在瀏覽器中訪問：
```
http://localhost:3000
```

---

## 📁 專案結構

```
gptrpg/
├── 📂 agent/                    # AI 代理後端服務
│   ├── index.js                 # WebSocket 伺服器入口
│   ├── ServerAgent.js           # AI 代理核心邏輯
│   ├── env.json                 # OpenAI API 配置 (需自行設定)
│   └── package.json             # 後端依賴管理
│
├── 📂 ui-admin/                 # React 前端應用
│   ├── 📂 src/
│   │   ├── 📂 assets/           # 遊戲資源檔案
│   │   │   ├── GPTRPGMap.json   # Tiled 地圖數據
│   │   │   ├── characters.png   # 角色圖集
│   │   │   └── v2.png           # 環境圖集
│   │   ├── create.js            # Phaser 場景初始化
│   │   ├── update.js            # 遊戲主循環更新邏輯
│   │   └── App.js               # React 主應用組件
│   └── package.json             # 前端依賴管理
│
├── package.json                 # 根專案配置
├── README.md                    # 專案說明文件
└── map.png                      # 地圖預覽圖
```

---

## 🔧 技術細節

### 前端技術棧 (ui-admin)

| 技術 | 版本 | 用途 |
|------|------|------|
| **React** | 18.1.0 | UI 框架 |
| **Phaser** | 3.55.2 | 2D 遊戲引擎 |
| **Grid Engine** | 2.15.0 | 網格移動系統 |
| **WebSocket (ws)** | 8.13.0 | 即時通訊 |

### 後端技術棧 (agent)

| 技術 | 版本 | 用途 |
|------|------|------|
| **Node.js** | 16.19.0 | 執行環境 |
| **WebSocket (ws)** | 8.13.0 | 即時通訊伺服器 |
| **OpenAI** | 3.2.1 | AI API 整合 |
| **extract-json-from-string** | 1.0.1 | JSON 解析工具 |
| **nodemon** | 2.0.22 | 開發熱重載 |

---

## 🤖 AI 代理運作原理

### 決策流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI 代理決策循環                                │
└─────────────────────────────────────────────────────────────────┘

1. 🎮 前端收集環境狀態
   ↓
   ├─ 代理當前位置 (x, y)
   ├─ 周圍物體與地形
   └─ 內部狀態 (睡意、飢餓等)

2. 📡 透過 WebSocket 發送到後端
   ↓
   { type: "requestNextMove", agent_id: "player", ... }

3. 🧠 後端構建 GPT Prompt
   ↓
   ┌────────────────────────────────────┐
   │ 你是一個 2D 世界中的 AI 代理      │
   │                                    │
   │ 能力: Move, Wait, Navigate, Sleep  │
   │ 位置: { x: 10, y: 5 }              │
   │ 周圍: { ... }                      │
   │ 睡意: 7/10                         │
   │                                    │
   │ 請以 JSON 格式回應下一步動作       │
   └────────────────────────────────────┘

4. 🌐 呼叫 OpenAI API (GPT-3.5/5)
   ↓
   (AI 分析環境並做出決策)

5. 📝 解析 JSON 回應
   ↓
   {
     "action": {
       "type": "move",
       "direction": "up"
     }
   }

6. 📤 回傳給前端
   ↓
   { type: "nextMove", agent_id: "player", data: {...} }

7. 🎬 前端執行動作
   ↓
   gridEngine.move("player", "up")

8. 🔄 回到步驟 1，開始下一個循環
```

### AI Prompt 範例

```
# Introduction
你是一個生活在 2D 模擬宇宙中的代理。
你的目標是盡力生存並滿足自己的需求。

# Capabilities
你有以下能力:
* Move (上、下、左、右移動)
* Wait (等待)
* Navigate (導航到指定座標)
* Sleep (睡覺以恢復精力)

# Current State
位置: { x: 15, y: 20 }
周圍環境: { north: "tree", south: "water", east: "grass", west: "rock" }
睡意: 8 out of 10 (非常疲倦)

# Response Format
請以 JSON 格式回應:
{
  "action": {
    "type": "sleep",
    "reason": "I'm very tired and need to rest"
  }
}
```

### 容錯機制

後端具備完善的錯誤處理：

1. **JSON 解析失敗** → 自動重試（最多 3 次）
2. **第 2 次重試** → 在 prompt 前加強調「必須回傳 JSON」
3. **提取失敗** → 使用 `extract-json-from-string` 智能提取
4. **API 錯誤** → 記錄錯誤並返回 null

---

## 🎮 遊戲操作

### 鍵盤控制

| 按鍵 | 功能 | 說明 |
|------|------|------|
| **方向鍵** | 移動角色 | 在玩家視角模式下控制角色移動 |
| **S** | 種植 | 在可種植圖塊上種植植物 |
| **D** | 收穫 | 收穫角色位置上的植物 |
| **V** | 切換視角 | 切換玩家視角 / 自由視角 |

### 視角模式

#### 🎯 玩家視角模式 (Player View)
- 攝影機跟隨角色
- 可使用方向鍵移動
- 可種植和收穫植物

#### 🌍 自由視角模式 (Free Camera)
- 攝影機可自由移動
- 方向鍵控制被禁用
- 適合觀察全局地圖

---

## 🛣️ 開發路線圖

### ✅ 已完成功能

- [x] 基礎 2D RPG 環境
- [x] AI 代理與 OpenAI API 整合
- [x] WebSocket 即時通訊
- [x] 角色移動與碰撞檢測
- [x] 植物種植與收穫系統
- [x] 自由視角切換

### 🚧 開發中

- [ ] **多代理支援** - 多個 AI 代理同時存在並互動
- [ ] **代理記憶系統** - AI 能記住過去的行動與經驗
- [ ] **代理目標系統** - 設定長期目標並規劃行動

### 📅 未來計劃

#### 🎯 代理能力擴展
- [ ] 喝水系統 (Drink)
- [ ] 進食系統 (Eat)
- [ ] 種植食物 (Plant Food)
- [ ] 收穫食物 (Harvest Food)
- [ ] 創作系統 (Write Poem, Paint, etc.)

#### 📊 代理狀態系統
- [ ] 飢餓度 (Hunger)
- [ ] 口渴度 (Thirst)
- [ ] 健康值 (Health)
- [ ] 情緒系統 (Mood)
- [ ] 社交需求 (Social Needs)

#### 🎒 遊戲系統
- [ ] 代理庫存系統
- [ ] 物品交互系統
- [ ] 建築建造系統
- [ ] 天氣與日夜循環

#### 🌐 多人與部署
- [ ] 人類玩家控制的角色
- [ ] 多人線上互動
- [ ] 網頁部署版本
- [ ] UI 增強（代理狀態面板、對話系統等）

---

## ❓ 常見問題

### Q1: 為什麼只支援 Node.js 16.19.0？

**A**: 本專案使用的部分依賴（特別是 OpenAI SDK 3.2.1）在該版本測試穩定。雖然理論上可以在其他版本運行，但建議使用 [nvm](https://github.com/nvm-sh/nvm) 切換到此版本以避免相容性問題。

```bash
nvm install 16.19.0
nvm use 16.19.0
```

### Q2: OpenAI API 呼叫會產生多少費用？

**A**: 每次 AI 代理做決策時都會呼叫 API。費用取決於：
- 使用的模型（GPT-3.5-turbo 較便宜，GPT-4 較貴）
- 決策頻率
- 每次請求的 token 數量

建議在開發時監控 OpenAI 使用量儀表板。

### Q3: 如何修改 AI 代理使用的模型？

**A**: 編輯 `agent/ServerAgent.js` 第 79 行：

```javascript
const response = await openai.createChatCompletion({
  model: "gpt-3.5-turbo",  // 改為你想要的模型
  messages: [{ role: "user", content: prompt }],
});
```

可用模型: `gpt-3.5-turbo`, `gpt-4`, `gpt-4-turbo` 等

### Q4: 地圖如何編輯？

**A**: 使用 [Tiled Map Editor](https://www.mapeditor.org/) 開啟 `ui-admin/src/assets/GPTRPGMap.json`。編輯後存檔即可，無需重新編譯。

### Q5: 如何新增更多 AI 代理能力？

**A**: 修改 `agent/ServerAgent.js` 的 prompt，在 `Capabilities` 區塊新增能力描述，並在前端對應處理新的 action type。

---

## 🤝 貢獻指南

歡迎各種形式的貢獻！

1. Fork 本專案
2. 建立功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交變更 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

---

## 📄 授權條款

本專案採用 ISC 授權條款 - 詳見 [LICENSE](LICENSE) 文件

---

## 🙏 致謝

- **Phaser** - 強大的 2D 遊戲引擎
- **Grid Engine** - 優雅的網格移動解決方案
- **OpenAI** - 提供強大的 AI 能力
- **Tiled** - 直觀的地圖編輯工具

---

## 📧 聯繫方式

如有問題或建議，歡迎透過以下方式聯繫：

- 提交 Issue: [GitHub Issues](https://github.com/your-username/gptrpg/issues)
- 討論區: [GitHub Discussions](https://github.com/your-username/gptrpg/discussions)

---

<div align="center">

**⭐ 如果這個專案對你有幫助，請給我們一個 Star！**

Made with ❤️ by GPTRPG Team

</div>
