"use client";

import { useMemo, useState } from "react";
import type { NotionGame } from "@/lib/types";
import FilterBar from "./FilterBar";
import GameCard from "./GameCard";

interface GameGalleryProps {
  initialGames: NotionGame[];
}

export default function GameGallery({ initialGames }: GameGalleryProps) {
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [maxPlayTime, setMaxPlayTime] = useState(240);
  const [minWeight, setMinWeight] = useState(1);

  const filteredGames = useMemo(() => {
    return initialGames.filter((game) => {
      if (playerCount !== null) {
        if (game.minPlayers > playerCount || game.maxPlayers < playerCount) {
          return false;
        }
      }

      if (game.playTime > maxPlayTime) {
        return false;
      }

      if (game.complexity < minWeight) {
        return false;
      }

      return true;
    });
  }, [initialGames, playerCount, maxPlayTime, minWeight]);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-8 sm:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Board Game Collection
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          顯示 {filteredGames.length} / {initialGames.length} 款遊戲
        </p>
      </header>

      <FilterBar
        playerCount={playerCount}
        maxPlayTime={maxPlayTime}
        minWeight={minWeight}
        onPlayerCountChange={setPlayerCount}
        onMaxPlayTimeChange={setMaxPlayTime}
        onMinWeightChange={setMinWeight}
      />

      {initialGames.length === 0 ? (
        <div className="flex min-h-[50vh] items-center justify-center p-8">
          <p className="text-sm text-gray-500">No games found in Notion database.</p>
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="flex min-h-[50vh] items-center justify-center p-8">
          <p className="text-sm text-gray-500">沒有符合篩選條件的遊戲，請調整篩選器。</p>
        </div>
      ) : (
        <section className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-3 xl:grid-cols-4">
          {filteredGames.map((game) => (
            <GameCard key={game.pageId} game={game} />
          ))}
        </section>
      )}
    </main>
  );
}
