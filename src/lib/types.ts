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
