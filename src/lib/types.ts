export interface BggGame {
  bggId: number;
  name: string;
  image: string;
  minPlayers: number;
  maxPlayers: number;
  bestPlayers: string;
  playTime: number;
  weight: number;
  rating: number;
}

export interface NotionGame {
  pageId: string;
  bggId: number;
  name: string;
  chineseName?: string;
  comment?: string;
  type?: 'Base' | 'Expansion';
  ownership?: 'Owned' | 'Played Elsewhere';
  image: string;
  minPlayers: number;
  maxPlayers: number;
  bestPlayers: string;
  playTime: number;
  complexity: number;
  rating: number;
  playCount: number;
  bggLink: string;
  /** Score field labels configured in Notion (multi-select). If empty/undefined, use legacy single score. */
  scoreFields?: string[];
}

export interface Player {
  id: string;
  name: string;
}

export interface PlayRecord {
  id: string;
  date: string;
  gameId: string;
  players: Player[];
  scores: string;
}

/** A player in the local player library */
export interface SavedPlayer {
  id: string;
  name: string;
}

/** A single score entry for a player – supports multiple named score fields */
export interface PlayerScoreEntry {
  label: string;    // e.g. "建設分", "動物分", "總分"
  value: number;
}

export interface PlayLogPlayer {
  name: string;
  /** Legacy single score – kept for backward compatibility */
  score: number;
  /** New multi-score fields – e.g. [{ label: "建設分", value: 42 }, { label: "動物分", value: 18 }] */
  scores?: PlayerScoreEntry[];
  factionOrColor?: string;
  isWinner: boolean;
}

export interface PlayLog {
  id: string;
  gameId: string;
  gameName: string;
  date: string;
  location?: string;
  durationMinutes: number;
  players: PlayLogPlayer[];
  endgamePhotoUrl?: string;
  notes?: string;
}

export interface SmartFilterTag {
  id: string;
  label: string;
  icon: string;
  description: string;
  filterFn: (game: NotionGame) => boolean;
  applyFilters: () => { minWeight: number; maxPlayTime: number };
}

/** Configuration for which score fields a game expects */
export interface GameScoreConfig {
  gameName: string;
  /** Ordered list of score field labels. Empty array = use legacy single score. */
  scoreFields: string[];
}