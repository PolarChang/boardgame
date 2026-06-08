"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const AUTH_TOKEN_KEY = "boardgame_auth_token";
const AUTH_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

export default function GameGallery({ initialGames }: GameGalleryProps) {
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [maxPlayTime, setMaxPlayTime] = useState(() =>
    getMaxPlayTimeLimit(initialGames)
  );
  const [minWeight, setMinWeight] = useState(1);
  const [sortBy, setSortBy] = useState<SortBy>("rating_desc");
  const [adminPassword, setAdminPassword] = useState("");
  const isAdmin = adminPassword !== "";
  const restoredFromStorage = useRef(false);

  // On mount, restore auth token from localStorage
  useEffect(() => {
    if (restoredFromStorage.current) return;
    try {
      const raw = localStorage.getItem(AUTH_TOKEN_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.expiry > Date.now() && data.password) {
          setAdminPassword(data.password);
        } else {
          // Token expired or invalid — clean up
          localStorage.removeItem(AUTH_TOKEN_KEY);
        }
      }
    } catch {
      // Corrupted data — clean up
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
    restoredFromStorage.current = true;
  }, []);
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
    console.log("🎲 pickOne clicked, filteredGames length:", filteredGames.length);
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
                if (pwd) {
                  setAdminPassword(pwd);
                  // Persist to localStorage with a 30-day expiry
                  const token = {
                    password: pwd,
                    expiry: Date.now() + AUTH_DURATION_MS,
                  };
                  localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(token));
                }
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              {isAdmin ? '🔓' : '🔒'}
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setAdminPassword("");
                  localStorage.removeItem(AUTH_TOKEN_KEY);
                }}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                title="鎖定 / 登出管理員"
              >
                鎖定
              </button>
            )}
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
      
      {/* Picker Modal */}
      {pickerOpen && pickedGame && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity duration-200 ${
            pickerVisible ? "opacity-100" : "opacity-0"
          }`}
          onClick={closePicker}
        >
          <div
            className={`max-h-[85vh] w-full max-w-md transform overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl transition-all duration-200 ${
              pickerVisible ? "scale-100" : "scale-95"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {pickedGame.image && (
              <div className="relative mb-4 aspect-[3/2] w-full overflow-hidden rounded-xl">
                <Image
                  src={pickedGame.image}
                  alt={pickedGame.name}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 400px"
                />
              </div>
            )}
            <h2 className="text-xl font-bold text-gray-900">{pickedGame.chineseName || pickedGame.name}</h2>
            {pickedGame.chineseName && (
              <p className="mt-1 text-sm text-gray-500">{pickedGame.name}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-600">
              {pickedGame.minPlayers > 0 && pickedGame.maxPlayers > 0 && (
                <span className="rounded-md bg-gray-100 px-2.5 py-1">
                  👥 {pickedGame.minPlayers}-{pickedGame.maxPlayers}人
                </span>
              )}
              {pickedGame.playTime ? (
                <span className="rounded-md bg-gray-100 px-2.5 py-1">⏱ {pickedGame.playTime}分</span>
              ) : null}
              {pickedGame.complexity ? (
                <span className="rounded-md bg-gray-100 px-2.5 py-1">⚖ {pickedGame.complexity.toFixed(1)}</span>
              ) : null}
              {pickedGame.rating ? (
                <span className="rounded-md bg-gray-100 px-2.5 py-1">⭐ {pickedGame.rating.toFixed(1)}</span>
              ) : null}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={repick}
                className="flex-1 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500 active:scale-[0.98]"
              >
                🎲 換一個
              </button>
              <button
                type="button"
                onClick={closePicker}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-[0.98]"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
