# Sync Pipeline Specification

**Objective:** Fetch XML data from BGG, convert to JSON, and sync (upsert) to Notion Database using `scripts/sync-bgg.ts`.

## 1. Type Definitions (Must use these exactly)
```typescript
interface BggGame {
  bggId: number;        // From <item objectid="X">
  name: string;         // From <name>
  image: string;        // From <image>
  minPlayers: number;   // From <stats minplayers="X">
  maxPlayers: number;   // From <stats maxplayers="X">
  bestPlayers: string;  // From <poll name="suggested_numplayers"> (derive the max voted num)
  playTime: number;     // From <stats playingtime="X">
  weight: number;       // From <statistics><ratings><averageweight value="X">
  rating: number;       // From <statistics><ratings><average value="X">
}