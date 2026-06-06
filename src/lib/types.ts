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
