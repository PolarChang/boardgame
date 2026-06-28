export interface BoardGameNewsEntry {
  bgg_id: string;
  name: string;
  year: number;
  image: string;
  thumbnail: string;
  min_players: number;
  max_players: number;
  play_time: number;
  min_age: number;
  weight: number;
  rating: number;
  users_rated: number;
  bgg_rank: number;
  categories: string[];
  mechanics: string[];
  designers: string[];
  best_players_summary: number[];
  best_for: number[];
}

export interface BoardGameNewsData {
  [playerCount: string]: BoardGameNewsEntry[];
}

export const BOARDGAME_NEWS_URL =
  "https://drive.google.com/uc?export=download&id=1HD8xDwt8eFx_iK5UhhLOZ7OUXZ1vQtAB";
