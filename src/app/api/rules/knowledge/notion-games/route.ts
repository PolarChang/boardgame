import { NextResponse } from "next/server";
import { getGamesFromNotion } from "@/lib/notion";
import type { KnowledgeNotionGame } from "@/lib/rules-knowledge";

/** Provides Notion collection games for the knowledge manager. */
export async function GET() {
  try {
    const notionGames = await getGamesFromNotion();
    const games: KnowledgeNotionGame[] = notionGames.map((game) => ({
      pageId: game.pageId,
      bggId: game.bggId,
      knowledgeGameId: `bgg-${game.bggId}`,
      name: game.name,
      chineseName: game.chineseName,
      publisher: game.publisher,
      designer: game.designer ? game.designer.split(",").map((name) => name.trim()).filter(Boolean) : [],
      player_count: { min: game.minPlayers || 1, max: game.maxPlayers || Math.max(game.minPlayers, 1) },
      play_time: { min: game.playTime || 60, max: game.playTime || 90 },
      complexity: game.complexity ? String(game.complexity) : null,
    }));
    return NextResponse.json({ games });
  } catch (error) {
    console.error("Failed to load Notion games for rules knowledge:", error);
    return NextResponse.json(
      { error: "Failed to load Notion game collection", detail: error instanceof Error ? error.message : undefined },
      { status: 500 },
    );
  }
}
