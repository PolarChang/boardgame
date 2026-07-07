"use client";

import type { GameScoreConfig } from "@/lib/types";

const STORAGE_KEY = "boardgame_score_configs";

/**
 * Default score configs for known games.
 * These are only used as a fallback when Notion data is unavailable.
 * The primary source is now the Notion "Score Fields" multi-select property.
 */
const DEFAULT_CONFIGS: GameScoreConfig[] = [
  // Example: Ark Nova – 保育分 (Conservation) +  appeal分 (Appeal)
  // Both first players then head-to-head on 最終計分 (Final Scoring)
  { gameName: "Ark Nova", scoreFields: ["保育點數", "吸引力", "最終分數"] },

  // Example: 7 Wonders Duel – 軍事 and 科學 are instant-win paths,
  // but if neither triggers, compare civilian points
  {
    gameName: "7 Wonders Duel",
    scoreFields: ["軍事力", "科學力", "民⽤點數"],
    victoryConditions: ["⚔️ 軍事壓制", "🔬 科技壟斷", "🏛️ 民用比分"],
  },

  // Example: Terraforming Mars – TR vs VP, with final scoring as third
  { gameName: "Terraforming Mars", scoreFields: ["TR", "VP (不含TR)", "最終結算"] },

  // Placeholder for your unnamed game – adjust the name & fields as needed
  // { gameName: "你的遊戲名稱", scoreFields: ["類型A分數", "類型B分數", "類型C分數"] },
];

/** Fetch score configs from Notion via API, falling back to local defaults. */
export async function fetchScoreConfigsFromNotion(): Promise<GameScoreConfig[]> {
  try {
    const res = await fetch("/api/score-configs");
    if (res.ok) {
      const notionConfigs = (await res.json()) as GameScoreConfig[];
      // Merge: defaults lower priority, Notion configs override by gameName
      const merged = new Map<string, GameScoreConfig>();
      DEFAULT_CONFIGS.forEach((c) => merged.set(c.gameName, c));
      notionConfigs.forEach((c) => merged.set(c.gameName, c));
      return Array.from(merged.values());
    }
  } catch {
    // Silently fall through to defaults
  }
  return DEFAULT_CONFIGS;
}

/**
 * Look up score fields from an in-memory list of NotionGame API items.
 * This is the preferred path — AddPlayLogModal already has allGames loaded.
 */
export function getScoreFieldsFromGamesList(
  gamesList: { name: string; scoreFields?: string[] }[],
  gameName: string
): string[] | null {
  if (!gameName.trim()) return null;
  const game = gamesList.find(
    (g) => g.name.toLowerCase() === gameName.trim().toLowerCase()
  );
  if (!game || !game.scoreFields || game.scoreFields.length === 0) return null;
  return game.scoreFields;
}
/**
 * Look up victory conditions from an in-memory list of NotionGame API items.
 * Falls back to code defaults if not found in the list.
 */
export function getVictoryConditionsFromGamesList(
  gamesList: { name: string; victoryConditions?: string[] }[],
  gameName: string
): string[] | null {
  if (!gameName.trim()) return null;
  // First check the in-memory list (from Notion API)
  const game = gamesList.find(
    (g) => g.name.toLowerCase() === gameName.trim().toLowerCase()
  );
  if (game && game.victoryConditions && game.victoryConditions.length > 0) {
    return game.victoryConditions;
  }
  // Fall back to code defaults / localStorage
  return getVictoryConditionsForGame(gameName);
}



/** Legacy: Get all score configs (defaults + user overrides from localStorage). */
export function getScoreConfigs(): GameScoreConfig[] {
  if (typeof window === "undefined") return DEFAULT_CONFIGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIGS;
    const userConfigs = JSON.parse(raw) as GameScoreConfig[];
    // Merge: defaults take lower priority, user configs override by gameName
    const merged = new Map<string, GameScoreConfig>();
    DEFAULT_CONFIGS.forEach((c) => merged.set(c.gameName, c));
    userConfigs.forEach((c) => merged.set(c.gameName, c));
    return Array.from(merged.values());
  } catch {
    return DEFAULT_CONFIGS;
  }
}

/** Legacy: Get score fields for a specific game. Returns null if not configured (use legacy single score). */
export function getScoreFieldsForGame(gameName: string): string[] | null {
  const configs = getScoreConfigs();
  const config = configs.find(
    (c) => c.gameName.toLowerCase() === gameName.toLowerCase()
  );
  if (!config || config.scoreFields.length === 0) return null;
  return config.scoreFields;
}

/** Get victory conditions for a specific game from code defaults / localStorage. Returns null if not configured. */
export function getVictoryConditionsForGame(gameName: string): string[] | null {
  const configs = getScoreConfigs();
  const config = configs.find(
    (c) => c.gameName.toLowerCase() === gameName.toLowerCase()
  );
  if (!config || !config.victoryConditions || config.victoryConditions.length === 0) return null;
  return config.victoryConditions;
}



/** Legacy: Save user-customised score configs */
export function saveScoreConfig(configs: GameScoreConfig[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

/** Legacy: Add or update a single game's score config */
export function setGameScoreConfig(config: GameScoreConfig): void {
  const existing = getScoreConfigs();
  const idx = existing.findIndex(
    (c) => c.gameName.toLowerCase() === config.gameName.toLowerCase()
  );
  if (idx >= 0) {
    existing[idx] = config;
  } else {
    existing.push(config);
  }
  saveScoreConfig(existing);
}