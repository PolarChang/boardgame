import GameGallery from "@/components/GameGallery";
import { getGamesFromNotion } from "@/lib/notion";

export default async function Home() {
  const games = await getGamesFromNotion();

  return <GameGallery initialGames={games} />;
}
