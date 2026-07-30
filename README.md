# 🎲 Board Game Collection — Euro-Classic Ledger

> **給 AI 助手的快速導覽**：這是一個以 **Next.js App Router** 打造的桌遊收藏展示與戰績追蹤 Web App。資料來源有三：(1) **Notion** 作為 CMS（遊戲庫、遊玩記錄、玩家、分數），(2) **BoardGameGeek (BGG) API** 透過 GitHub Actions 每日同步收藏，(3) **BoardGameNews 雲端 JSON** 提供精選推薦。另有外部 **FastAPI 規則查詢引擎**（`/rules` 頁面）。UI 採用 Euro-Classic 歐式古典設計風格（羊皮紙底色 + 黃銅飾邊）。

---

## 📑 目錄

- [功能概覽](#-功能概覽)
- [技術棧](#-技術棧)
- [專案結構](#-專案結構)
- [資料架構與工作流](#-資料架構與工作流)
- [API Routes 參考](#-api-routes-參考)
- [環境變數](#-環境變數)
- [Notion 資料庫結構](#-notion-資料庫結構)
- [快速開始](#-快速開始)
- [npm Scripts](#-npm-scripts)
- [BGG 同步管線](#-bgg-同步管線)
- [測試](#-測試)
- [設計主題](#-設計主題)
- [AI 開發指南](#-ai-開發指南)

---

## ✨ 功能概覽

### 🖼️ 遊戲牆 (`/` — SSR)
- 從 Notion 載入遊戲收藏，前端即時篩選
- **篩選**：玩家人數、最大遊戲時間、最低複雜度、擴充/擁有狀態
- **Smart Filter Tags**：Heavy Euro、Light Party、Duel、Masterpieces 等策展標籤
- **搜尋**：中英文遊戲名搜尋
- **3 種檢視模式**：Card、Compact Grid、List
- **排序**：BGG Rating（降序）或 Weight（升/降序）
- **最佳人數模式**：只顯示在選定人數下表現最佳的遊戲
- **隨機選遊戲**：擲骰決定玩什麼（Admin only）
- **Admin 新增遊戲**：透過 BGG ID 直接從 BGG 抓取資料新增至 Notion

### 📊 戰績表 (`/dashboard` — Client-side)
- **摘要卡片**：總場次、不重複玩家、平均分數、最多遊玩遊戲
- **🏆 玩家排行榜**：勝率排名 + 蠟封皇冠徽章
- **📊 遊戲頻率圖表**：最多遊玩遊戲的長條圖
- **📜 完整記錄表**：按時間排序，可展開詳情面板
- **多分數支援**：透過 Notion multi-select `Score Fields` 記錄多類別分數（如「保育分」、「吸引力」）
- **勝利條件**：透過 Notion multi-select `Victory Conditions` 記錄勝利方式（如「⚔️ 軍事壓制」）
- **玩家庫管理**：新增/刪除玩家（儲存於 Notion）

### 🎯 精選推薦 (`/picks` — SSR)
- 來源：BoardGameNews 雲端 JSON（Google Drive）或 `ALL_GAMES_JSON_URL` 環境變數
- 依玩家人數（2–6 人）分區展示最佳遊戲
- 每款遊戲顯示 BGG 排名、複雜度、評分、人數、時間、分類
- 可篩選特定最佳人數
- 資料每小時重新驗證（`revalidate: 3600`）

### 📜 規則查詢 (`/rules` — Client-side)
- 代理至外部 FastAPI 規則查詢引擎（`BOARDGAME_RULES_API_URL`，預設 `http://localhost:8000`）
- 可選擇特定遊戲或跨全部遊戲查詢
- 支援語意搜尋（top-k 結果）與 LLM 模式（單一回應）
- 顯示相關度分數

### 🔒 Admin 認證
- 透過 `window.prompt()` 輸入密碼 + `localStorage` token（30 天有效期）
- Admin 密碼由 `ADMIN_PASSWORD` 環境變數控制
- Gallery 與 Dashboard 共用 Admin 狀態

### 🌙 Dark Mode
- `layout.tsx` 內嵌 inline script，在頁面載入前讀取 `localStorage` 的 `boardgame-theme`
- 支援 `prefers-color-scheme: dark` 自動偵測

---

## 🏗️ 技術棧

| 技術 | 用途 |
|---|---|
| **Next.js 16** (App Router) | React 全端框架 |
| **React 18** | UI |
| **TypeScript** | 型別安全 |
| **Tailwind CSS 3** | 樣式 |
| **@notionhq/client** | Notion API 客戶端 |
| **fast-xml-parser** | BGG XML 解析 |
| **axios** | HTTP client（BGG 同步） |
| **zod** | Play record schema 驗證 |
| **lucide-react** | 圖示 |
| **vitest** + **@testing-library/react** + **jsdom** | 測試 |
| **GitHub Actions** | CI/CD + 每日 BGG 排程同步 |
| **tsx** | 執行 TypeScript 腳本（sync-bgg） |

---

## 📁 專案結構

```
Boardgame/
├── .env.example                      # 環境變數範本
├── .env.local                         # 本地環境變數（git ignored）
├── .eslintrc.json                     # ESLint 設定
├── .gitignore
├── next.config.js                     # Next.js 設定（JS 版本）
├── next.config.mjs                    # Next.js 設定（MJS 版本）
├── package.json                       # 依賴與 scripts
├── postcss.config.mjs                 # PostCSS 設定
├── tailwind.config.ts                 # Tailwind 設定（自訂色彩 token）
├── tsconfig.json                      # TypeScript 設定
├── vitest.config.ts                   # Vitest 設定
├── test-bgg.ts                        # BGG 測試腳本（根目錄）
│
├── .github/
│   ├── workflows/
│   │   └── bgg-sync.yml               # GitHub Actions — 每日 BGG 同步
│   └── prompts/                       # AI 設計技能 prompts（非專案核心）
│
├── docs/
│   ├── FRONTEND_WEB.md                # 前端規格文件
│   └── SYNC_PIPELINE.md               # BGG 同步管線規格
│
├── public/
│   └── .gitkeep
│
├── scripts/
│   ├── sync-bgg.ts                    # BGG XML → Notion upsert 同步腳本
│   ├── bgg-parser.ts                  # BGG XML 解析工具函式
│   └── check-notion-schema.ts         # Notion DB schema 驗證腳本
│
└── src/
    ├── app/
    │   ├── layout.tsx                 # Root layout（字體、導航列、dark mode script）
    │   ├── page.tsx                   # 首頁 — 遊戲牆（SSR）
    │   ├── globals.css                # Euro-Classic 主題全域樣式
    │   ├── dashboard/
    │   │   └── page.tsx               # 戰績表頁面（Client-side）
    │   ├── picks/
    │   │   └── page.tsx               # 精選推薦頁面（SSR，BoardGameNews）
    │   ├── rules/
    │   │   └── page.tsx               # 規則查詢頁面（Client-side）
    │   └── api/
    │       ├── games/route.ts         # GET 遊戲列表 / POST 從 BGG 新增遊戲
    │       ├── plays/route.ts         # GET / POST / DELETE 遊玩記錄
    │       ├── plays/route.test.ts    # Plays API 測試
    │       ├── players/route.ts       # GET / POST / DELETE 玩家
    │       ├── players/batch/route.ts # POST 批次建立玩家（Admin）
    │       ├── dashboard/plays/route.ts # GET 詳細遊玩記錄（含玩家/遊戲名）
    │       ├── score-configs/route.ts # GET 分數欄位設定
    │       ├── picks/route.ts         # GET BoardGameNews 精選推薦
    │       ├── rules/games/route.ts   # GET 規則引擎遊戲列表（Proxy）
    │       ├── rules/query/route.ts   # POST 規則查詢（Proxy）
    │       └── notion/route.ts        # GET 佔位（尚未實作）
    │
    ├── components/
    │   ├── GameGallery.tsx            # 主畫廊元件（篩選、搜尋、選遊戲）
    │   ├── GameCard.tsx               # 遊戲卡片（3 種檢視模式）
    │   ├── FilterBar.tsx              # 篩選控制列 + Smart Filter Tags
    │   ├── SearchBar.tsx              # 遊戲名搜尋
    │   ├── ViewToggle.tsx             # Card/Grid/List 檢視切換
    │   ├── SmartFilterTags.tsx        # 策展篩選捷徑標籤
    │   ├── MobileFilterDrawer.tsx     # 手機版篩選抽屜
    │   ├── AddPlayLogModal.tsx        # 新增遊玩記錄 Modal
    │   ├── PlayRecordModal.tsx        # 遊戲遊玩歷史 Modal
    │   └── __tests__/
    │       └── GameGallery.test.tsx   # GameGallery 元件測試
    │
    ├── hooks/
    │   └── useLocalStorage.ts         # localStorage React hook
    │
    ├── lib/
    │   ├── types.ts                   # TypeScript 介面（NotionGame, PlayLog, Player 等）
    │   ├── notion.ts                  # Notion API 客戶端（遊戲、遊玩、玩家、分數 CRUD）
    │   ├── notion-cache.ts            # 記憶體快取（30s TTL）
    │   ├── play-schema.ts             # Zod 驗證 schema（PlayRecord）
    │   ├── playlog-storage.ts         # localStorage 遊玩記錄 helpers
    │   ├── player-storage.ts          # localStorage 玩家 helpers
    │   ├── game-score-config.ts       # 多分數欄位設定（Notion + 本地 fallback）
    │   ├── boardgamenews.ts           # BoardGameNews 資料型別與 URL
    │   ├── picks.ts                   # 精選推薦資料正規化邏輯
    │   └── __tests__/
    │       └── picks.test.ts          # picks 正規化邏輯測試
    │
    └── test/
        └── setup.ts                   # Vitest setup（jest-dom 等）
```

---

## 🔄 資料架構與工作流

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        資料來源                                      │
├─────────────────┬──────────────────────┬────────────────────────────┤
│  BoardGameGeek  │  Notion (CMS)        │  BoardGameNews (Google Drive) │
│  API (XML)      │  4 Databases         │  JSON                      │
└───────┬─────────┴──────────┬───────────┴────────────┬───────────────┘
        │                    │                        │
        ▼                    │                        │
  GitHub Actions             │                        │
  (bgg-sync.yml)             │                        │
  每日 UTC 06:00             │                        │
        │                    │                        │
        ▼                    │                        │
  scripts/sync-bgg.ts        │                        │
  BGG XML → Notion upsert    │                        │
        │                    │                        │
        └─────────► Notion DB ◄────────────────────────┘
                     (4 DBs)                    │
                        │                       │ 直接 fetch
                        ▼                       ▼
              ┌─────────────────────────────────────┐
              │     Next.js App (App Router)         │
              │                                      │
              │  src/lib/notion.ts                   │
              │  (Notion API client + 30s cache)     │
              │                                      │
              │  ┌──────────┐  ┌──────────┐         │
              │  │ /        │  │/dashboard│         │
              │  │ (SSR)    │  │(Client)  │         │
              │  │ Game     │  │ Play Log │         │
              │  │ Gallery  │  │ Ledger   │         │
              │  └──────────┘  └──────────┘         │
              │  ┌──────────┐  ┌──────────┐         │
              │  │ /picks   │  │ /rules   │         │
              │  │ (SSR)    │  │(Client)  │         │
              │  │ BGN 精選 │  │→ FastAPI │         │
              │  └──────────┘  └──────────┘         │
              └─────────────────────────────────────┘
```

### 頁面渲染模式

| 頁面 | 路由 | 渲染模式 | 資料來源 |
|---|---|---|---|
| 遊戲牆 | `/` | **SSR**（Server Component） | Notion API（`getGamesFromNotion`） |
| 戰績表 | `/dashboard` | **Client-side** | `/api/dashboard/plays` → Notion |
| 精選推薦 | `/picks` | **SSR**（Server Component + Suspense） | Google Drive JSON / BoardGameNews |
| 規則查詢 | `/rules` | **Client-side** | `/api/rules/*` → 外部 FastAPI |

### Notion 快取策略

- `src/lib/notion-cache.ts` 提供記憶體快取，**TTL = 30 秒**
- `getGamesFromNotion()` 使用 cache key `notion:main_games`
- `getDetailedPlayLogs()` 平行抓取 4 個 Notion DB，各自獨立快取
- 寫入操作（POST/DELETE）後呼叫 `invalidateDashboardCache()` 清除快取
- `/api/dashboard/plays?refresh=true` 可手動清除快取

---

## 🌐 API Routes 參考

| Route | Method | 認證 | 描述 |
|---|---|---|---|
| `/api/games` | GET | — | 回傳所有遊戲（name, chineseName, pageId, scoreFields, victoryConditions） |
| `/api/games` | POST | Admin | 從 BGG 抓取遊戲資料並新增至 Notion（需 `bggId` + `password`） |
| `/api/plays` | GET | — | 取得遊玩記錄（可選 `?gameId=` 篩選） |
| `/api/plays` | POST | — | 建立遊玩場次 + 玩家分數（Zod 驗證，失敗時回滾） |
| `/api/plays` | DELETE | — | 刪除遊玩場次及相關分數（需 `?id=`） |
| `/api/players` | GET | — | 列出所有玩家 |
| `/api/players` | POST | Admin | 建立新玩家（需 `name` + `password`） |
| `/api/players` | DELETE | Admin | 刪除玩家（需 `playerId` + `password`） |
| `/api/players/batch` | POST | Admin | 批次建立玩家，跳過已存在名稱（需 `names[]` + `password`） |
| `/api/dashboard/plays` | GET | — | 取得詳細遊玩記錄（含已解析的玩家/遊戲名稱）。支援 `?refresh=true` 清除快取 |
| `/api/score-configs` | GET | — | 從 Notion 取得分數欄位設定（`GameScoreConfig[]`） |
| `/api/picks` | GET | — | 取得 BoardGameNews 精選推薦資料 |
| `/api/rules/games` | GET | — | 代理至外部 FastAPI 取得規則引擎遊戲列表 |
| `/api/rules/query` | POST | — | 代理至外部 FastAPI 進行規則查詢（需 `query`，可選 `game` + `top_k`） |
| `/api/notion` | GET | — | 佔位路由（尚未實作） |

---

## 🔐 環境變數

| 變數 | 必填 | 描述 |
|---|---|---|
| `NOTION_TOKEN` | ✅ | Notion Integration token（`ntn_xxx`） |
| `NOTION_DATABASE_ID` | ✅ | Main Games 資料庫 ID |
| `NOTION_PLAYS_DB_ID` | ✅ | Plays（遊玩場次）資料庫 ID |
| `NOTION_PLAYER_SCORES_DB_ID` | ✅ | Player Scores（玩家分數）資料庫 ID |
| `NOTION_PLAYERS_DB_ID` | ✅ | Players（玩家庫）資料庫 ID |
| `BGG_USERNAME` | ✅ | BGG 使用者名稱（同步收藏用） |
| `BGG_AUTH_VALUE` | ✅ | BGG 認證 cookie 值（突破 CORS 限制） |
| `ADMIN_PASSWORD` | ✅ | Admin 密碼（管理玩家/遊戲新增） |
| `BOARDGAME_RULES_API_URL` | ❌ | 規則查詢引擎 URL（預設 `http://localhost:8000`） |
| `ALL_GAMES_JSON_URL` | ❌ | 精選推薦雲端 JSON URL（覆蓋預設 Google Drive 連結） |

> **注意**：`.env.example` 僅列出部分變數。`NOTION_PLAYS_DB_ID`、`NOTION_PLAYER_SCORES_DB_ID`、`NOTION_PLAYERS_DB_ID` 也需要設定在 `.env.local` 中。

---

## 🗄️ Notion 資料庫結構

App 需要 **4 個 Notion 資料庫**：

### 1. Main Games（遊戲收藏）

| Property | Type | 說明 |
|---|---|---|
| `Game Title` | Title | 遊戲英文名 |
| `BGG ID` | Number | BGG 物品 ID（同步主鍵） |
| `Chinese Name` | Rich Text | 遊戲中文名 |
| `Cover Image` | Files | 封面圖片 |
| `Min Players` | Number | 最少玩家數 |
| `Max Players` | Number | 最多玩家數 |
| `Best Player Count` | Rich Text | 最佳人數 |
| `Playtime` | Number | 遊戲時間（分鐘） |
| `Complexity` | Number | 複雜度（BGG weight） |
| `BGG Rating` | Number | BGG 評分 |
| `BGG Link` | URL | BGG 連結 |
| `Play Count` | Number | 遊玩次數（受保護，同步不覆蓋） |
| `Type` | Select | `Base` / `Expansion` |
| `Ownership` | Select | `Owned` / `Played Elsewhere` |
| `Comment` | Rich Text | 註解（受保護） |
| `Score Fields` | Multi-select | 多分數欄位標籤（如「保育點數」、「吸引力」） |
| `Victory Conditions` | Multi-select | 勝利條件標籤（如「⚔️ 軍事壓制」） |

> **受保護欄位**（BGG 同步不會覆蓋）：`Chinese Name`、`Comment`、`heavy`、`Designer`、`My Rating`、`Price`、`Publisher`、`Purchase Date`、`Play Count`

### 2. Plays（遊玩場次）

| Property | Type | 說明 |
|---|---|---|
| `Play ID` | Title | 自動生成 ID（`play_{date}_{gameId}`） |
| `Date` | Date | 遊玩日期 |
| `Game` | Relation → Main Games | 關聯遊戲 |
| `Players` | Relation → Players | 關聯玩家（fallback 用） |
| `Scores` | Rich Text | 分數文字（fallback 用） |
| `Location` | Select | 地點 |
| `Notes` | Rich Text | 備註 |

### 3. Player Scores（玩家分數）

| Property | Type | 說明 |
|---|---|---|
| `Record ID` | Title | 自動生成 ID（`score_{timestamp}`） |
| `Plays (遊玩場次)` | Relation → Plays | 關聯遊玩場次 |
| `Player` | Relation → Players | 關聯玩家 |
| `Score` | Number | 分數 |
| `Is Winner` | Checkbox | 是否勝利 |
| `First Play` | Checkbox | 是否首次遊玩 |

### 4. Players（玩家庫）

| Property | Type | 說明 |
|---|---|---|
| `Name` | Title | 玩家名稱 |

---

## 🚀 快速開始

### 前置需求

- Node.js 20+
- Notion Integration token（[建立連結](https://www.notion.so/my-integrations)）
- BGG 帳號（用於同步收藏）
- 4 個 Notion 資料庫（如上節所述）

### 1. Clone & Install

```bash
git clone https://github.com/PolarChang/boardgame.git
cd boardgame
npm install
```

### 2. 設定環境變數

複製 `.env.example` 為 `.env.local`，填入所有必填變數（見[環境變數](#-環境變數)）。

### 3. 啟動開發伺服器

```bash
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000)。

### 4.（選用）啟動規則查詢引擎

`/rules` 頁面需要外部 FastAPI 規則查詢引擎。設定 `BOARDGAME_RULES_API_URL` 指向該服務（預設 `http://localhost:8000`）。若未啟動，`/rules` 頁面會顯示連線錯誤。

---

## 📦 npm Scripts

| Script | 描述 |
|---|---|
| `npm run dev` | 啟動 Next.js 開發伺服器 |
| `npm run build` | Production build |
| `npm run start` | 啟動 production 伺服器 |
| `npm run lint` | 執行 ESLint |
| `npm run sync:bgg` | 手動執行 BGG → Notion 同步 |
| `npm test` | 執行測試（Vitest） |
| `npm run test:watch` | Watch 模式測試 |

---

## 🔄 BGG 同步管線

同步透過 GitHub Actions（`.github/workflows/bgg-sync.yml`）每日 **UTC 06:00（台灣 14:00）** 執行。

### 流程

1. **抓取 Collection XML**：`https://boardgamegeek.com/xmlapi2/collection?username={BGG_USERNAME}&own=1&stats=1`
2. **萃取 objectid 列表**：從 Collection XML 中取出所有遊戲 ID
3. **批次抓取 Thing XML**：每批 20 個 ID，從 `https://boardgamegeek.com/xmlapi2/thing?id={ids}&stats=1` 取得詳細資料
4. **解析遊戲資料**：名稱、圖片、人數、時間、複雜度、評分、最佳人數（從 poll）
5. **Upsert 至 Notion**：
   - 以 `BGG ID` 為主鍵比對既有資料
   - 新遊戲 → 建立
   - 已存在且 `BGG Rating` 或 `Complexity` 有變動 → 更新
   - 已存在但無變動 → 跳過
   - **受保護欄位**不會被覆蓋

### 手動執行

```bash
npm run sync:bgg
```

或透過 GitHub Actions 的 `workflow_dispatch` 手動觸發。

---

## 🧪 測試

使用 **Vitest** + **@testing-library/react** + **jsdom**：

```bash
npm test           # 執行所有測試
npm run test:watch # Watch 模式
```

### 測試檔案

| 檔案 | 測試內容 |
|---|---|
| `src/components/__tests__/GameGallery.test.tsx` | GameGallery 元件 |
| `src/lib/__tests__/picks.test.ts` | picks 資料正規化邏輯 |
| `src/app/api/plays/route.test.ts` | Plays API route |

---

## 🎨 設計主題

UI 採用 **Euro-Classic** 歐式古典設計語言：

| 元素 | 色彩/字體 |
|---|---|
| 羊皮紙底色 | `#f7f4eb` |
| 黃銅飾邊 | `#c5a059` |
| 蠟封紅 | `#a84343` |
| 標題字體 | Cinzel |
| 強調字體 | Cormorant Garamond |
| 內文字體 | DM Sans + Noto Sans TC |
| 特色 | 雙層黃銅邊框、Ledger 風格表格、蠟封皇冠徽章 |

Dark mode 透過 `layout.tsx` 內嵌 script + Tailwind `dark:` class 支援。

---

## 🤖 AI 開發指南

在為此專案生成程式碼時，請遵循以下原則：

1. **技術棧**：Next.js 16+（App Router）、React 18、Tailwind CSS 3、TypeScript
2. **不過度工程化**：使用 `@notionhq/client` 直接操作 Notion API，不引入 Redux/Prisma/ORM
3. **無外部認證服務**：Admin 認證僅用 `process.env.ADMIN_PASSWORD` 比對
4. **型別優先**：所有型別定義在 `src/lib/types.ts`，API 驗證用 `src/lib/play-schema.ts`（Zod）
5. **快取**：讀取 Notion 資料時使用 `src/lib/notion-cache.ts`（30s TTL），寫入後記得 `invalidateDashboardCache()`
6. **受保護欄位**：BGG 同步腳本（`scripts/sync-bgg.ts`）中的 `PROTECTED_FIELDS` 不可出現在 sync payload
7. **逐步實作**：只實作被要求的特定檔案或函式
8. **渲染模式**：遊戲牆和精選推薦用 SSR（Server Component），戰績表和規則查詢用 Client-side
9. **API 代理**：`/api/rules/*` 是外部 FastAPI 的代理，不要在 Next.js 端實作規則查詢邏輯
10. **設計風格**：使用 Tailwind 自訂色彩 token（`parchment`、`brass`、`ink`、`wax-red` 等），遵循 Euro-Classic 風格

---

## 📚 文件

- [`docs/FRONTEND_WEB.md`](./docs/FRONTEND_WEB.md) — 前端元件規格
- [`docs/SYNC_PIPELINE.md`](./docs/SYNC_PIPELINE.md) — BGG 同步管線規格