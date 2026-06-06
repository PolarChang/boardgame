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
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [pickedGame, setPickedGame] = useState<NotionGame | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

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
    const filtered = initialGames.filter((game) => {
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
    });

    const ratingValue = (g: NotionGame) => g.rating || 0;
    const weightValueAsc = (g: NotionGame) =>
      g.complexity === 0 ? Number.POSITIVE_INFINITY : g.complexity;
    const weightValueDesc = (g: NotionGame) =>
      g.complexity === 0 ? -1 : g.complexity;

    return filtered.sort((a, b) => {
      if (sortBy === "rating_desc") {
        return ratingValue(b) - ratingValue(a);
      }
      if (sortBy === "weight_desc") {
        return weightValueDesc(b) - weightValueDesc(a);
      }
      return weightValueAsc(a) - weightValueAsc(b);
    });
  }, [initialGames, playerCount, maxPlayTime, minWeight, sortBy]);

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
      if (e.key === "Escape") {
        closePicker();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pickerOpen, closePicker]);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Board Game Collection
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              顯示 {filteredGames.length} / {initialGames.length} 款遊戲
            </p>
          </div>

          <div className="mt-1 flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 hover:text-gray-900"
            >
              📊 戰績儀表板
            </Link>
            <button
              type="button"
              onClick={() => {
                const pwd = window.prompt("請輸入管理員密碼：");
                if (pwd) setAdminPassword(pwd);
              }}
              className="rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              aria-label="Admin"
            >
              🔒
            </button>
          </div>
        </div>
      </header>

      <FilterBar
        playerCount={playerCount}
        maxPlayTime={maxPlayTime}
        maxPlayTimeLimit={maxPlayTimeLimit}
        minWeight={minWeight}
        sortBy={sortBy}
        onSmartPick={pickOne}
        onPlayerCountChange={setPlayerCount}
        onMaxPlayTimeChange={setMaxPlayTime}
        onMinWeightChange={setMinWeight}
        onSortByChange={setSortBy}
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
          className="fixed bottom-4 right-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-lg transition hover:bg-gray-50"
          aria-label="Scroll to top"
        >
          ↑
        </button>
      ) : null}

      {pickerOpen && pickedGame ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            aria-label="Close"
            onClick={closePicker}
            className={`absolute inset-0 cursor-default bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
              pickerVisible ? "opacity-100" : "opacity-0"
            }`}
          />

          <div
            role="dialog"
            aria-modal="true"
            className={`relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white to-violet-50 shadow-2xl transition-all duration-200 ${
              pickerVisible
                ? "scale-100 opacity-100"
                : "scale-95 opacity-0"
            }`}
          >
            <div className="flex items-start justify-between gap-4 border-b border-violet-100/80 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                  Smart Picker
                </p>
                <h2 className="mt-1 truncate text-base font-bold text-gray-900 sm:text-lg">
                  {pickedGame.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={closePicker}
                className="rounded-lg px-2 py-1 text-sm font-medium text-gray-600 hover:bg-white/70 hover:text-gray-900"
              >
                關閉
              </button>
            </div>

            <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-5 sm:gap-6 sm:p-6">
              <div className="sm:col-span-2">
                <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-white shadow">
                  {pickedGame.image ? (
                    <Image
                      src={pickedGame.image}
                      alt={pickedGame.name}
                      fill
                      sizes="(max-width: 640px) 100vw, 40vw"
                      className="object-cover"
                      priority
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-gray-400">
                      No cover image
                    </div>
                  )}
                </div>
              </div>

              <div className="sm:col-span-3">
                <div className="rounded-2xl border border-violet-100 bg-white/70 p-4 sm:p-5">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold text-white">
                      {pickedGame.minPlayers}–{pickedGame.maxPlayers} 人
                    </span>
                    <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">
                      {pickedGame.playTime} 分鐘
                    </span>
                    {pickedGame.bestPlayers ? (
                      <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
                        Best {pickedGame.bestPlayers} 人
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-gray-100">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Rating
                      </p>
                      <p className="mt-1 text-base font-bold text-gray-900">
                        {pickedGame.rating.toFixed(1)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-gray-100">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Weight
                      </p>
                      <p className="mt-1 text-base font-bold text-gray-900">
                        {pickedGame.complexity.toFixed(1)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={repick}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500 active:scale-[0.98]"
                  >
                    <span aria-hidden="true">🎲</span>
                    重新抽一次
                  </button>
                  <button
                    type="button"
                    onClick={closePicker}
                    className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 active:scale-[0.98]"
                  >
                    就決定是它了
                  </button>
                </div>

                <p className="mt-3 text-xs text-gray-500">
                  目前抽籤範圍：{filteredGames.length} 款（依照你現在的篩選條件）
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
