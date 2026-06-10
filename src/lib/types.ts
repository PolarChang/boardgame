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

export interface PlayLogPlayer {
  name: string;
  score: number;
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
