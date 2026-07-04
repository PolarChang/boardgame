import { getGamesFromNotion } from "@/lib/notion";
import GameGallery from "@/components/GameGallery";
import type { NotionGame } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  let games: NotionGame[] = [];
  let error: string | null = null;

  try {
    games = await getGamesFromNotion();
  } catch (e) {
    console.error("Failed to fetch games from Notion:", e);
    error = "Cannot load games from Notion. Please check API configuration.";
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-20 sm:px-8">
        <div className="rounded-sm border border-red-300 bg-red-50 p-6 text-center">
          <p className="text-lg text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  return <GameGallery initialGames={games} />;
}
