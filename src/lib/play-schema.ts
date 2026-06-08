import { z } from 'zod';

export const PlayerScoreSchema = z.object({
  playerId: z.string().min(1, "Player ID is required"),
  score: z.number(),
  isWinner: z.boolean(),
  firstPlay: z.boolean(),
});

export const PlayRecordSchema = z.object({
  gameId: z.string().min(1, "Game ID is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  location: z.string().min(1, "Location is required"),
  notes: z.string().optional(),
  playerScores: z.array(PlayerScoreSchema).min(1, "At least one player score is required"),
});

export type PlayRecord = z.infer<typeof PlayRecordSchema>;
export type PlayerScore = z.infer<typeof PlayerScoreSchema>;
