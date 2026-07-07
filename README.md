# 🎲 Board Game Collection — Euro-Classic Ledger

A serverless web application for showcasing a **BoardGameGeek (BGG) collection** and tracking **play session history**, built with **Next.js 14 (App Router)**, **Notion API (as CMS)**, and **GitHub Actions** for automated BGG data syncing.

---

## ✨ Features

### 🖼️ Game Gallery Wall (`/`)
- **Rich filtering**: Filter by player count, max play time, minimum weight (complexity), and curated **Smart Filter Tags** (Heavy Euro, Light Party, Duel, Masterpieces)
- **Search**: Search games by Chinese or English name
- **3 view modes**: Card, Compact Grid, and List
- **Sorting**: By BGG Rating (desc) or Weight (asc/desc)
- **Toggle expansions** and **ownership** (Owned / All)
- **Best player count mode**: Only show games that shine at your selected player count
- **Random game picker**: Let the dice decide what to play! (Admin only)

### 📊 Dashboard / Play Log Ledger (`/dashboard`)
- **Summary cards**: Total plays, unique players, average score, most played game
- **🏆 Player leaderboard**: Win rate rankings with wax seal crowns
- **📊 Game frequency chart**: Bar chart of most-played games
- **📜 Full ledger table**: Chronological history with expandable detail panels
- **Multi-score support**: Record per-category scores (e.g. "Conservation", "Appeal") via Notion's multi-select `Score Fields`
- **Endgame photo upload**: Attach photos to play sessions
- **Player library management**: Add/remove players stored in Notion

### 🔒 Admin Authentication
- Simple password-based admin mode via `window.prompt()` + `localStorage` token (30-day expiry)
- Admin authentication shared across the Gallery and Dashboard

### 🔄 BGG Sync Pipeline
- **Scheduled sync**: GitHub Actions runs daily (UTC 06:00) to fetch your BGG collection
- **Upsert logic**: Syncs BGG data (name, image, players, play time, weight, rating) into Notion
- **Manual add**: Admins can add games by BGG ID directly from the gallery
- **BGG authentication**: Supports CORS-restricted API access via `BGG_AUTH_VALUE`

---

## 🏗️ Architecture

```text
BoardgameGeek API ──► scripts/sync-bgg.ts (cron) ──► Notion Database
                                    │
                            GitHub Actions
                            (bgg-sync.yml)
                                    │
                            Scheduled daily sync
                                    │
                                    ▼
Next.js App (Server Components) ──► Notion API ──► Client Components
  ┌─────────────┐       ┌──────────────┐       ┌──────────────────┐
  │  app/page   │──────►│  lib/notion   │──────►│  GameGallery      │
  │ (SSR fetch) │       │ (cached, 30s)│       │  (client filter)  │
  └─────────────┘       └──────────────┘       └──────────────────┘
  ┌─────────────────────┐       ┌──────────────┐       ┌──────────────────┐
  │  app/dashboard/page │──────►│  lib/notion   │──────►│  Play Log Ledger │
  │  (client fetch)     │       │ (cached, 30s)│       │  (leaderboard)   │
  └─────────────────────┘       └──────────────┘       └──────────────────┘
```

---

## 📁 Project Structure

```
├── .env.example                    # Environment variable template
├── .github/workflows/bgg-sync.yml  # Daily BGG sync via GitHub Actions
├── scripts/
│   ├── sync-bgg.ts                 # BGG XML → Notion upsert script
│   ├── bgg-parser.ts               # BGG XML parsing utilities
│   └── check-notion-schema.ts      # Notion DB schema validation
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (fonts, header, navigation)
│   │   ├── page.tsx                # Homepage — Game Gallery (SSR)
│   │   ├── globals.css             # Euro-Classic parchment/brass theme
│   │   ├── dashboard/
│   │   │   └── page.tsx            # Dashboard — Play Log Ledger (client)
│   │   └── api/
│   │       ├── games/route.ts      # GET list games, POST add game from BGG
│   │       ├── plays/route.ts      # GET/play-history, POST create play, DELETE
│   │       ├── players/route.ts    # GET list, POST create, DELETE player
│   │       ├── dashboard/plays/route.ts  # GET detailed play logs (with names)
│   │       └── score-configs/route.ts   # GET score field configs from Notion
│   ├── components/
│   │   ├── GameGallery.tsx         # Main gallery with filtering, search, picker
│   │   ├── GameCard.tsx            # Game card (3 view modes: card/grid/list)
│   │   ├── FilterBar.tsx           # Filter controls + Smart Filter Tags
│   │   ├── SearchBar.tsx           # Game name search
│   │   ├── ViewToggle.tsx          # Card/Grid/List view toggle
│   │   ├── SmartFilterTags.tsx     # Curated filter shortcuts
│   │   ├── AddPlayLogModal.tsx     # Modal for recording new play sessions
│   │   ├── PlayRecordModal.tsx     # Modal showing play history for a game
│   │   └── __tests__/
│   │       └── GameGallery.test.tsx
│   ├── hooks/
│   │   └── useLocalStorage.ts      # localStorage React hook
│   ├── lib/
│   │   ├── types.ts                # TypeScript interfaces (NotionGame, PlayLog, etc.)
│   │   ├── notion.ts               # Notion API client (games, plays, players, scores)
│   │   ├── notion-cache.ts         # In-memory cache with 30s TTL
│   │   ├── play-schema.ts          # Zod validation for play records
│   │   ├── playlog-storage.ts      # localStorage play log helpers
│   │   ├── player-storage.ts       # localStorage player helpers
│   │   └── game-score-config.ts    # Multi-score field config (Notion + local fallback)
│   └── test/
│       └── setup.ts                # Vitest setup
├── docs/
│   ├── FRONTEND_WEB.md             # Frontend specification
│   └── SYNC_PIPELINE.md            # Sync pipeline specification
├── vitest.config.ts
├── tailwind.config.ts
├── next.config.mjs
├── postcss.config.mjs
├── tsconfig.json
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- A [Notion Integration](https://www.notion.so/my-integrations) token
- BGG username (for syncing)

### 1. Clone & Install

```bash
git clone <repo-url>
cd boardgame
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
# Notion API
NOTION_TOKEN=ntn_xxxxxxxxxxxxxxxxxxxx
NOTION_DATABASE_ID=<Main Games Database ID>

# Notion Play Log Databases
NOTION_PLAYS_DB_ID=<Plays Session Database ID>
NOTION_PLAYER_SCORES_DB_ID=<Player Scores Database ID>
NOTION_PLAYERS_DB_ID=<Players Database ID>

# BGG Sync
BGG_USERNAME=<your-bgg-username>
BGG_AUTH_VALUE=<bgg-auth-cookie-value>  # For CORS-bypass (optional)

# Admin
ADMIN_PASSWORD=<your-secret-admin-password>
```

### 3. Notion Database Setup

The app expects **4 Notion databases**:

| Database | Purpose | Key Properties |
|---|---|---|
| **Main Games** | Game collection | `Game Title`, `BGG ID`, `Chinese Name`, `Cover Image`, `Min Players`, `Max Players`, `Best Player Count`, `Playtime`, `Complexity`, `BGG Rating`, `BGG Link`, `Play Count`, `Type`, `Ownership`, `Comment`, `Score Fields` (multi-select) |
| **Plays** | Play sessions | `Play ID`, `Date`, `Game` (relation), `Location`, `Notes` |
| **Player Scores** | Per-player results | `Record ID`, `Plays (遊玩場次)` (relation), `Player` (relation), `Score`, `Is Winner`, `First Play` |
| **Players** | Player library | `Name` |

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 📦 Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run sync:bgg` | Run BGG → Notion sync manually |
| `npm test` | Run tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |

---

## 🌐 API Routes

| Route | Method | Description |
|---|---|---|
| `/api/games` | GET | Returns all games (name, chineseName, pageId, scoreFields) |
| `/api/games` | POST | Add a game from BGG by `bggId`+`password` |
| `/api/plays` | GET | Get play records (optional `gameId` filter) |
| `/api/plays` | POST | Create a play session + player scores |
| `/api/plays` | DELETE | Delete a play session and related scores |
| `/api/dashboard/plays` | GET | Get detailed play logs (with resolved player/game names). Supports `?refresh=true` to bust cache |
| `/api/players` | GET | List all players |
| `/api/players` | POST | Create a new player (admin auth required) |
| `/api/players` | DELETE | Delete a player (admin auth required) |
| `/api/score-configs` | GET | Get score field configs from Notion |

---

## 🎨 Theme

The UI features a **Euro-Classic** design language:

- **Parchment background** with subtle grid lines (`#f7f4eb`)
- **Brass accents** (`#c5a059`) for borders, buttons, and highlights
- **Wax seal** badges (`#a84343`) for winners
- **Fonts**: Cinzel (headings), Cormorant Garamond (accent), DM Sans (body)
- **Double-border brass frames** for featured elements
- **Ledger-style tables** for the dashboard

---

## 🔄 BGG Sync Pipeline

The sync runs daily via GitHub Actions (`bgg-sync.yml`) at **UTC 06:00 (Taiwan 14:00)**.

1. Fetches your BGG collection XML via `https://boardgamegeek.com/xmlapi2/collection`
2. Parses detailed game data via `https://boardgamegeek.com/xmlapi2/thing`
3. Upserts each game into the **Notion Main Games database**
4. **Idempotent**: Identifies games by `BGG ID` to avoid duplicates

You can also trigger it manually: `npm run sync:bgg`

---

## 🧪 Testing

Built with **Vitest** + **@testing-library/react** + **jsdom**:

```bash
npm test           # Run all tests
npm run test:watch # Watch mode
```

---

## 📚 Documentation

- [`docs/FRONTEND_WEB.md`](./docs/FRONTEND_WEB.md) — Frontend component specifications
- [`docs/SYNC_PIPELINE.md`](./docs/SYNC_PIPELINE.md) — BGG sync pipeline details

---

## 🤖 AI Developer Guidelines

When generating code for this project:

1. **Stack**: Next.js 14+ (App Router), React, Tailwind CSS, TypeScript
2. **No over-engineering**: Use `@notionhq/client`, not Redux/Prisma/ORMs
3. **No auth providers**: Simple `process.env.ADMIN_PASSWORD` check for admin routes
4. **Types first**: Rely on TypeScript interfaces in `docs/` and `src/lib/types.ts`
5. **Step-by-step**: Only implement the specific file or function requested

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Next.js 14+ (App Router) | React framework |
| React 18 | UI |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| @notionhq/client | Notion API |
| fast-xml-parser | BGG XML parsing |
| axios | HTTP client (BGG sync) |
| zod | Schema validation |
| lucide-react | Icons |
| vitest + @testing-library | Testing |
| GitHub Actions | CI/CD + scheduled sync |