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
- ✅ **四種記憶系統** - 短期記憶、長期記憶、位置記憶、互動記憶
- ✅ **目標追蹤系統** - AI 可設定、追蹤和完成目標
- ✅ **持久化存儲** - 使用 SQLite 保存記憶和目標，重啟後保留
- ✅ **環境感知能力** - 感知位置、周圍物體、地形資訊
- ✅ **內部狀態系統** - 追蹤睡意、飢餓、口渴等生理狀態
- ✅ **自主行動能力** - 移動、等待、導航、睡眠等基礎動作
- ✅ **WebSocket 即時通訊** - 前後端即時雙向溝通
- ✅ **多代理架構支援** - 可同時運行多個獨立 AI 代理

---

## 🏗️ 系統架構

```
┌─────────────────────────────────────────────────────────────────────┐
│                          GPTRPG 系統                                 │
├─────────────────────────┬───────────────────────────────────────────┤
│                         │                                           │
│    前端 (ui-admin)      │      後端 (agent)                         │
│                         │                                           │
│  ┌──────────────────┐   │   ┌──────────────────┐                    │
│  │  React App       │   │   │  WebSocket       │                    │
│  │  (Port 3000)     │◄──┼──►│  Server          │                    │
│  └──────────────────┘   │   │  (Port 8080)     │                    │
│           │              │   └────────┬─────────┘                    │
│           ▼              │            │                              │
│  ┌──────────────────┐   │            ▼                              │
│  │  Phaser Engine   │   │   ┌──────────────────┐                    │
│  │  + Grid Engine   │   │   │  ServerAgent     │                    │
│  └──────────────────┘   │   │  核心決策系統    │                    │
│           │              │   └────────┬─────────┘                    │
│           ▼              │            │                              │
│  ┌──────────────────┐   │   ┌────────┴─────────┐                    │
│  │  Tiled Map       │   │   │                  │                    │
│  │  Renderer        │   │   ▼                  ▼                    │
│  └──────────────────┘   │   ┌──────────┐  ┌──────────┐              │
│                         │   │ Memory   │  │  Goal    │              │
│                         │   │ Manager  │  │ Manager  │              │
│                         │   └────┬─────┘  └────┬─────┘              │
│                         │        │             │                    │
│                         │        └──────┬──────┘                    │
│                         │               ▼                           │
│                         │        ┌─────────────┐                    │
│                         │        │  Database   │                    │
│                         │        │  (SQLite)   │                    │
│                         │        └─────────────┘                    │
│                         │               │                           │
│                         │               ▼                           │
│                         │        ┌─────────────┐                    │
│                         │        │  OpenAI API │                    │
│                         │        │(GPT-4o-mini)│                    │
│                         │        └─────────────┘                    │
└─────────────────────────┴───────────────────────────────────────────┘
```

### 核心組件說明

#### 後端組件
- **WebSocket Server**: 處理前後端即時通訊
- **ServerAgent**: 核心 AI 決策引擎，整合記憶和目標系統
- **MemoryManager**: 管理四種記憶類型（短期、長期、位置、互動）
- **GoalManager**: 追蹤和管理 AI 代理的目標
- **Database**: SQLite 持久化層，保存記憶和目標數據
- **OpenAI API**: 提供智能決策能力

#### 前端組件
- **React App**: 主應用框架
- **Phaser Engine**: 2D 遊戲渲染引擎
- **Grid Engine**: 網格移動和碰撞系統
- **Tiled Map Renderer**: 地圖渲染器

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

複製範例配置文件並編輯：

```bash
cd agent
cp env.example.json env.json
```

編輯 `agent/env.json` 檔案，填入你的 OpenAI API 金鑰：

```json
{
  "OPENAI_API_KEY": "sk-your-api-key-here",
  "OPENAI_MODEL": "gpt-4o-mini",
  "MEMORY_SHORT_TERM_SIZE": 10,
  "MEMORY_LONG_TERM_THRESHOLD": 7,
  "MEMORY_LOCATION_RADIUS": 5,
  "DATABASE_PATH": "./agent_memory.db"
}
```

**配置說明**：
- `OPENAI_API_KEY`: 你的 OpenAI API 金鑰
- `OPENAI_MODEL`: 使用的模型（推薦 `gpt-4o-mini` 性價比高）
- `MEMORY_SHORT_TERM_SIZE`: 短期記憶保留數量（預設 10 條）
- `MEMORY_LONG_TERM_THRESHOLD`: 長期記憶重要性閾值（7-10 分的記憶會被保留）
- `MEMORY_LOCATION_RADIUS`: 位置記憶搜索半徑
- `DATABASE_PATH`: SQLite 數據庫文件路徑

> ⚠️ **安全提醒**: `env.json` 已加入 `.gitignore`，請勿將 API 金鑰提交到版本控制系統！

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
│   ├── ServerAgent.js           # AI 代理核心邏輯（整合記憶和目標）
│   ├── database.js              # SQLite 數據庫封裝
│   ├── MemoryManager.js         # 記憶管理系統（四種記憶類型）
│   ├── GoalManager.js           # 目標管理系統（目標追蹤與達成檢測）
│   ├── env.json                 # OpenAI API 配置 (需自行設定)
│   ├── env.example.json         # 配置範例文件
│   ├── agent_memory.db          # SQLite 數據庫文件 (自動生成)
│   ├── test-database.js         # 數據庫測試
│   ├── test-memory.js           # 記憶系統測試
│   ├── test-goals.js            # 目標系統測試
│   ├── test-integration.js      # 整合測試
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
│   │   ├── Agent.js             # 前端 AI 代理控制器
│   │   └── App.js               # React 主應用組件
│   └── package.json             # 前端依賴管理
│
├── package.json                 # 根專案配置
├── README.md                    # 專案說明文件
├── rosy-tinkering-giraffe.md    # 記憶與目標系統實現計劃
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
| **OpenAI** | 4.x (latest) | AI API 整合 (已升級) |
| **better-sqlite3** | latest | SQLite 數據庫 (記憶持久化) |
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

## 🧠 記憶與目標系統

### 四種記憶類型

GPTRPG 實現了完整的記憶系統，讓 AI 代理能夠記住過去並做出更智能的決策：

#### 1. 📝 短期記憶 (Short-term Memory)
- **用途**: 記錄最近的行動和結果
- **保留數量**: 最近 10 條（可配置）
- **示例**: 「剛才向上移動了」、「種植了一棵樹」
- **清理機制**: 自動清理過舊的記憶

#### 2. 🧠 長期記憶 (Long-term Memory)
- **用途**: 保存重要事件和經驗
- **重要性評分**: 1-10 分（7 分以上才會注入到 prompt）
- **示例**: 「發現了水源」、「完成了第一次收穫」
- **持久化**: 永久保存在數據庫

#### 3. 🗺️ 位置記憶 (Location Memory)
- **用途**: 記錄探索過的位置和資源
- **數據**: 座標、地形類型、訪問次數、資源信息
- **功能**:
  - 查找附近已探索位置
  - 搜索特定資源位置（如床、水源）
  - 追蹤訪問頻率

#### 4. 🎮 互動記憶 (Interaction Memory)
- **用途**: 記錄所有互動行為
- **類型**: move, plant, harvest, sleep 等
- **數據**: 互動類型、位置、結果、時間戳
- **統計**: 可查詢特定互動的次數和歷史

### 目標系統

AI 代理可以設定和追蹤目標，使行為更有目的性：

#### 目標屬性
- **描述** (description): 目標的具體內容
- **類型** (goal_type): survival, exploration, resource, social 等
- **優先級** (priority): 1-10，決定目標執行順序
- **狀態** (status): active, completed, failed, abandoned
- **元數據** (metadata): 目標達成條件等額外信息

#### 目標類型示例

```javascript
// 導航目標
{
  description: "到達安全的地方休息",
  goal_type: "navigation",
  priority: 8,
  metadata: { target_location: { x: 7, y: 6 } }
}

// 睡眠目標
{
  description: "休息直到完全恢復",
  goal_type: "sleep",
  priority: 9
}

// 資源收集目標
{
  description: "收集 5 個種子",
  goal_type: "resource",
  priority: 7,
  metadata: { resource_type: "seeds", target_amount: 5 }
}
```

#### 自動目標達成檢測

系統會自動檢查目標是否達成：
- **導航目標**: 到達目標位置時自動完成
- **睡眠目標**: 睡意歸零時完成
- **資源目標**: 達到目標數量時完成

完成目標後會自動記錄到長期記憶（重要性：9 分）。

### 記憶注入到 Prompt

每次決策時，AI 會收到包含記憶的增強 prompt：

```
# Recent Actions (短期記憶)
1. Action: {"type":"move","direction":"up"} → Result: {"success":true}
2. Action: {"type":"plant"} → Result: {"success":true}

# Important Memories (長期記憶)
1. [Importance: 9] 發現了水源在 (15, 20)
2. [Importance: 8] 完成了第一次收穫

# Known Nearby Locations (位置記憶)
- (10, 10): grass, visited 3 times
- (15, 20): water, visited 1 times

# Current Goal
**Goal**: 探索世界並了解周圍環境
**Priority**: 5/10
**Type**: exploration
```

### 數據持久化

所有記憶和目標都保存在 SQLite 數據庫中：
- **位置**: `agent/agent_memory.db`
- **優點**: 代理重啟後記憶保留
- **性能**: 使用索引優化查詢速度
- **清理**: 自動清理過舊的短期記憶

### 數據庫架構

```sql
-- 記憶表 (四種記憶類型統一存儲)
CREATE TABLE memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  memory_type TEXT NOT NULL,  -- 'short_term', 'long_term', 'location', 'interaction'
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  content TEXT NOT NULL,       -- JSON 格式的記憶內容
  importance INTEGER DEFAULT 1, -- 1-10，重要性評分
  embedding TEXT               -- 可選：向量嵌入（未來用於語義搜索）
);

-- 目標表
CREATE TABLE goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  goal_type TEXT NOT NULL,     -- 'survival', 'exploration', 'social', etc.
  description TEXT NOT NULL,   -- 目標描述
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'failed', 'abandoned'
  priority INTEGER DEFAULT 5,  -- 1-10 優先級
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  metadata TEXT                -- JSON 格式的額外數據
);

-- 位置探索表
CREATE TABLE explored_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  tile_type TEXT,
  resources TEXT,              -- JSON: 該位置的資源
  visit_count INTEGER DEFAULT 1,
  first_visited DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_visited DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(agent_id, x, y)
);

-- 互動歷史表
CREATE TABLE interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  interaction_type TEXT NOT NULL, -- 'plant', 'harvest', 'sleep', 'move'
  location_x INTEGER,
  location_y INTEGER,
  result TEXT,                 -- JSON: 互動結果
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🧪 測試系統

階段 1 實現了完整的測試套件，確保系統穩定性：

### 執行測試

```bash
cd agent

# 測試數據庫連接和基礎操作
node test-database.js

# 測試記憶系統（四種記憶類型）
node test-memory.js

# 測試目標系統（創建、完成、達成檢測）
node test-goals.js

# 測試完整整合流程
node test-integration.js
```

### 測試覆蓋範圍

- ✅ **數據庫測試** - 連接、CRUD 操作、索引
- ✅ **記憶系統測試** - 短期、長期、位置、互動記憶的讀寫
- ✅ **目標系統測試** - 目標創建、狀態變更、達成檢測
- ✅ **整合測試** - 端到端決策流程（記憶 → 目標 → 決策）

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

### ✅ 階段 1：OpenAI 主角系統（已完成）

- [x] **基礎設施**
  - [x] SQLite 數據庫設置與封裝
  - [x] OpenAI SDK v4 升級與整合
  - [x] WebSocket 即時通訊
  - [x] 基礎 2D RPG 環境（Phaser + Grid Engine）

- [x] **四種記憶系統**
  - [x] 短期記憶（最近行動追蹤）
  - [x] 長期記憶（重要事件保存）
  - [x] 位置記憶（地圖探索記錄）
  - [x] 互動記憶（行為歷史追蹤）

- [x] **目標追蹤系統**
  - [x] 目標創建與管理
  - [x] 目標優先級排序
  - [x] 自動目標達成檢測
  - [x] 目標完成記錄到長期記憶

- [x] **系統整合**
  - [x] 記憶注入到 AI Prompt
  - [x] 目標驅動決策系統
  - [x] SQLite 持久化存儲
  - [x] 單元測試與整合測試

### 🚧 階段 2：標籤解析架構（計劃中）

基於 [rosy-tinkering-giraffe.md](rosy-tinkering-giraffe.md) 的設計，為未來的 Ollama NPC 系統準備：

- [ ] **標籤系統設計**
  - [ ] XML-like 標籤語法規範（`<action type="move" direction="up" />`）
  - [ ] 標籤解析器實現（正則提取）
  - [ ] 容錯機制（即使格式不完美也能提取）

- [ ] **LLM Provider 抽象層**
  - [ ] 支持 JSON + Tag 雙模式輸出
  - [ ] OpenAI Provider（JSON 模式）
  - [ ] 為 Ollama Provider 預留接口
  - [ ] 向後兼容性保證

### 📅 階段 3：Ollama NPC 系統（未來擴展）

- [ ] **Ollama 整合**
  - [ ] Ollama Provider 實現
  - [ ] Tag-based 輸出解析
  - [ ] 本地模型調用優化

- [ ] **NPC 代理系統**
  - [ ] 簡化版記憶系統（適合 NPC）
  - [ ] 動物人格設定（狗、牛、雞等）
  - [ ] NPC 行為模式（grazing, barking, following）
  - [ ] 多代理管理系統

- [ ] **前端多角色支持**
  - [ ] 多 NPC 同時渲染
  - [ ] NPC 思考過程顯示
  - [ ] 玩家-NPC 互動系統

### 🎯 其他未來計劃

#### 代理能力擴展
- [ ] 喝水系統 (Drink)
- [ ] 進食系統 (Eat)
- [ ] 種植食物 (Plant Food)
- [ ] 收穫食物 (Harvest Food)
- [ ] 創作系統 (Write Poem, Paint, etc.)

#### 代理狀態系統
- [ ] 飢餓度 (Hunger)
- [ ] 口渴度 (Thirst)
- [ ] 健康值 (Health)
- [ ] 情緒系統 (Mood)
- [ ] 社交需求 (Social Needs)

#### 遊戲系統
- [ ] 代理庫存系統
- [ ] 物品交互系統
- [ ] 建築建造系統
- [ ] 天氣與日夜循環

#### 多人與部署
- [ ] 人類玩家控制的角色
- [ ] 多人線上互動
- [ ] 網頁部署版本
- [ ] UI 增強（代理狀態面板、對話系統等）

---

> 📖 **詳細實現計劃**: 請參考 [rosy-tinkering-giraffe.md](rosy-tinkering-giraffe.md) 查看完整的記憶與目標系統實現計劃

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

### Q6: 記憶系統如何運作？

**A**: AI 代理擁有四種記憶：
1. **短期記憶**: 保留最近 10 個行動（可在 `env.json` 配置）
2. **長期記憶**: 保存重要性 ≥7 的事件，永久保留
3. **位置記憶**: 記錄探索過的座標、地形和資源
4. **互動記憶**: 追蹤所有互動行為（move, plant, sleep 等）

每次 AI 做決策時，相關記憶會自動注入到 prompt 中，讓 AI 能夠基於過去經驗做出更智能的決策。

### Q7: 如何查看 AI 的記憶和目標？

**A**: 目前記憶和目標保存在 SQLite 數據庫中。你可以：

1. 使用 SQLite 工具查看：
```bash
cd agent
sqlite3 agent_memory.db

# 查看所有記憶
SELECT * FROM memories;

# 查看當前目標
SELECT * FROM goals WHERE status = 'active';

# 查看探索過的位置
SELECT * FROM explored_locations;
```

2. 運行測試腳本查看系統運作：
```bash
node test-memory.js    # 測試記憶系統
node test-goals.js     # 測試目標系統
```

### Q8: AI 代理的記憶會一直增長嗎？會不會影響性能？

**A**: 不會無限增長：
- **短期記憶**: 自動保留最新的 N 條（預設 10 條）
- **長期記憶**: 只保存重要性高的事件（≥7 分）
- **位置記憶**: 使用索引優化，查詢速度 <50ms
- **數據庫**: 可定期清理過舊的記憶（未來功能）

目前的設計可以支持數千條記憶而不影響性能。

### Q9: 如何重置 AI 代理的記憶？

**A**: 刪除數據庫文件即可：
```bash
cd agent
rm agent_memory.db
```

下次啟動時會自動創建新的空數據庫。

### Q10: 階段 2 和 3 什麼時候實現？

**A**:
- **階段 2**（標籤解析架構）: 計劃中，為支持 Ollama 本地模型準備
- **階段 3**（NPC 系統）: 未來擴展，實現多個 AI 動物 NPC

詳細計劃請參考 [rosy-tinkering-giraffe.md](rosy-tinkering-giraffe.md)

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
