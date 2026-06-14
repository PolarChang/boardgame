import { NextResponse } from "next/server";
import { getGamesFromNotion } from "@/lib/notion";
import type { GameScoreConfig } from "@/lib/types";

/**
 * GET /api/score-configs
 * Returns GameScoreConfig[] built from the Notion game database.
 * Games with a multi-select "Score Fields" property will have their
 * score fields reflected here. Games without it will be absent from
 * the list, meaning they use legacy single-score mode.
 */
export async function GET() {
  try {
    const games = await getGamesFromNotion();
    const configs: GameScoreConfig[] = games
      .filter((g) => g.scoreFields && g.scoreFields.length > 0)
      .map((g) => ({
        gameName: g.name,
        scoreFields: g.scoreFields!,
      }));
    return NextResponse.json(configs);
  } catch (error) {
    console.error("Failed to fetch score configs:", error);
    return NextResponse.json(
      { error: "Failed to fetch score configs" },
      { status: 500 }
    );
  }
}