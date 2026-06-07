"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { NotionGame } from "@/lib/types";
import FilterBar from "./FilterBar";
import GameCard from "./GameCard";

interface GameGalleryProps {
  initialGames: NotionGame[];
}

type SortBy = "rating_desc" | "weight_desc" | "weight_asc";

function getMaxPlayTimeLimit(games: NotionGame[]) {
  const maxFromData = Math.max(...games.map((g) => g.playTime || 0));
  return Math.max(240, maxFromData);
}

export default function GameGallery({ initialGames }: GameGalleryProps) {
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [maxPlayTime, setMaxPlayTime] = useState(() =>
    getMaxPlayTimeLimit(initialGames)
  );
  const [minWeight, setMinWeight] = useState(1);
  const [sortBy, setSortBy] = useState<SortBy>("rating_desc");
  const [adminPassword, setAdminPassword] = useState("");
  const isAdmin = adminPassword !== "";
  const [newBggId, setNewBggId] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [pickedGame, setPickedGame] = useState<NotionGame | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  
  // New filters
  const [showExpansions, setShowExpansions] = useState(false);
  const [ownershipFilter, setOwnershipFilter] = useState<'Owned' | 'All'>('Owned');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  const maxPlayTimeLimit = useMemo(() => {
    return getMaxPlayTimeLimit(initialGames);
  }, [initialGames]);

  useEffect(() => {
    setMaxPlayTime((prev) => Math.min(prev, maxPlayTimeLimit));
  }, [maxPlayTimeLimit]);

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const filteredGames = useMemo(() => {
    return initialGames.filter((game) => {
      if (!showExpansions && game.type === 'Expansion') return false;
      if (ownershipFilter === 'Owned' && game.ownership !== 'Owned') return false;

      if (playerCount !== null) {
        if (game.minPlayers > playerCount || game.maxPlayers < playerCount) {
          return false;
        }
      }

      if (game.playTime !== 0 && game.playTime > maxPlayTime) {
        return false;
      }

      if (game.complexity !== 0 && game.complexity < minWeight) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      const ratingValue = (g: NotionGame) => g.rating || 0;
      const weightValueAsc = (g: NotionGame) =>
        g.complexity === 0 ? Number.POSITIVE_INFINITY : g.complexity;
      const weightValueDesc = (g: NotionGame) =>
        g.complexity === 0 ? -1 : g.complexity;

      if (sortBy === "rating_desc") {
        return ratingValue(b) - ratingValue(a);
      }
      if (sortBy === "weight_desc") {
        return weightValueDesc(b) - weightValueDesc(a);
      }
      return weightValueAsc(a) - weightValueAsc(b);
    });
  }, [initialGames, playerCount, maxPlayTime, minWeight, sortBy, showExpansions, ownershipFilter]);

  const closePicker = useCallback(() => {
    setPickerVisible(false);
    window.setTimeout(() => {
      setPickerOpen(false);
      setPickedGame(null);
    }, 200);
  }, []);

  const pickOne = useCallback(() => {
    if (filteredGames.length === 0) {
      window.alert("目前條件下沒有符合的遊戲");
      return;
    }

    const picked =
      filteredGames[Math.floor(Math.random() * filteredGames.length)];
    setPickedGame(picked);
    setPickerOpen(true);
  }, [filteredGames]);

  const repick = useCallback(() => {
    if (filteredGames.length === 0) {
      window.alert("目前條件下沒有符合的遊戲");
      closePicker();
      return;
    }
    const picked =
      filteredGames[Math.floor(Math.random() * filteredGames.length)];
    setPickedGame(picked);
    setPickerVisible(false);
    window.setTimeout(() => setPickerVisible(true), 10);
  }, [closePicker, filteredGames]);

  useEffect(() => {
    if (!pickerOpen) return;
    setPickerVisible(false);
    const t = window.setTimeout(() => setPickerVisible(true), 10);
    return () => window.clearTimeout(t);
  }, [pickerOpen, pickedGame]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePicker();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pickerOpen, closePicker]);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-gray-900">
              Board Game Collection
            </h1>
            <p className="text-xs text-gray-500">
              {filteredGames.length} / {initialGames.length} 款
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const pwd = window.prompt("請輸入管理員密碼：");
                if (pwd) setAdminPassword(pwd);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              {isAdmin ? '🔓' : '🔒'}
            </button>
            <button 
                className="md:hidden p-2 text-gray-600"
                onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            >
                ⚙️
            </button>
          </div>
        </div>
        {isAdmin && (
          <div className="mx-auto mt-4 max-w-7xl flex gap-2">
            <input 
              placeholder="BGG ID" 
              value={newBggId} 
              onChange={e => setNewBggId(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm w-32"
            />
            <button 
              disabled={isAdding}
              onClick={async () => {
                  setIsAdding(true);
                  await fetch('/api/games', {
                      method: 'POST',
                      body: JSON.stringify({ bggId: newBggId, password: adminPassword })
                  });
                  setNewBggId('');
                  setIsAdding(false);
                  window.location.reload();
              }}
              className="bg-black text-white px-4 py-2 rounded-lg text-sm"
            >
              {isAdding ? '處理中...' : '➕ 新增桌遊'}
            </button>
          </div>
        )}
      </header>

      <div className={`${isFilterExpanded ? 'block' : 'hidden'} md:block`}>
          <FilterBar
            playerCount={playerCount}
            maxPlayTime={maxPlayTime}
            maxPlayTimeLimit={maxPlayTimeLimit}
            minWeight={minWeight}
            sortBy={sortBy}
            showExpansions={showExpansions}
            ownershipFilter={ownershipFilter}
            onSmartPick={pickOne}
            onPlayerCountChange={setPlayerCount}
            onMaxPlayTimeChange={setMaxPlayTime}
            onMinWeightChange={setMinWeight}
            onSortByChange={setSortBy}
            onShowExpansionsChange={setShowExpansions}
            onOwnershipFilterChange={setOwnershipFilter}
          />
      </div>

      {filteredGames.length === 0 ? (
        <div className="flex min-h-[50vh] items-center justify-center p-8">
          <p className="text-sm text-gray-500">沒有符合篩選條件的遊戲。</p>
        </div>
      ) : (
        <section className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-3 xl:grid-cols-4">
          {filteredGames.map((game) => (
            <GameCard
              key={game.pageId}
              game={game}
              isAdmin={isAdmin}
              adminPassword={adminPassword}
            />
          ))}
        </section>
      )}

      {showScrollTop ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-4 right-4 h-11 w-11 rounded-full bg-white text-gray-700 shadow-lg"
        >
          ↑
        </button>
      ) : null}
      
      {/* (Picker modal code would follow here...) */}
    </main>
  );
}
