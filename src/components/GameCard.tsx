"use client";

import { useState } from "react";
import Image from "next/image";
import type { NotionGame } from "@/lib/types";
import type { ViewMode } from "./ViewToggle";
import PlayRecordModal from "./PlayRecordModal";

interface GameCardProps {
  game: NotionGame;
  mode?: ViewMode;
  isAdmin?: boolean;
  adminPassword?: string;
}

export default function GameCard({ game, mode = "card", isAdmin = false, adminPassword }: GameCardProps) {
  const [open, setOpen] = useState(false);
  const trimmedChineseName = (game.chineseName ?? "").trim();
  const hasChineseName = trimmedChineseName.length > 0;
  const primaryName = hasChineseName ? trimmedChineseName : game.name;

  // --- Card Mode (default, single-column large card) ---
  if (mode === "card") {
    return (
      <>
        <article className="card-euro group flex flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="relative h-48 cursor-pointer bg-parchment-dark text-left"
          >
            {game.image ? (
              <Image
                src={game.image}
                alt={primaryName}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className="object-contain transition-transform duration-200 group-hover:scale-[1.05] p-2"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-ink-muted">
                No cover image
              </div>
            )}
            <div className="absolute left-2 top-2 flex flex-col gap-1">
              {game.type === 'Expansion' && (
                  <span className="rounded-full bg-euro-blue px-2 py-0.5 text-[10px] font-bold text-parchment">🧩 擴充</span>
              )}
              {game.ownership === 'Played Elsewhere' && (
                  <span className="rounded-full bg-sepia px-2 py-0.5 text-[10px] font-bold text-parchment">☕ 外出</span>
              )}
            </div>
            <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-ink/60 px-2 py-1">
              <span className="text-[10px] font-bold text-brass">{game.complexity > 0 ? game.complexity.toFixed(1) : '-'}</span>
            </div>
          </button>

          <div className="flex flex-1 flex-col gap-2 p-4">
            <div>
              <h2 className="font-heading text-sm font-bold leading-snug text-ink">
                {primaryName}
              </h2>
              {hasChineseName && (
                <p className="mt-0.5 text-xs text-ink-muted">{game.name}</p>
              )}
            </div>

            <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
              <span className="rounded-full border border-grid-line bg-parchment px-2 py-0.5 text-[10px] font-medium text-ink-light">
                {game.minPlayers}–{game.maxPlayers} 人
              </span>
              <span className="rounded-full border border-grid-line bg-parchment px-2 py-0.5 text-[10px] font-medium text-ink-light">
                {game.playTime > 0 ? `${game.playTime} 分鐘` : '時間未定'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="btn-euro-primary mt-3 w-full rounded-lg py-2 text-xs font-bold"
            >
              遊玩紀錄
            </button>
          </div>
        </article>

        <PlayRecordModal
          open={open}
          onClose={() => setOpen(false)}
          gameId={game.pageId}
          gameName={primaryName}
          gameEnglishName={game.name}
          gameImage={game.image}
          comment={game.comment ?? ""}
          isAdmin={isAdmin}
          adminPassword={adminPassword}
        />
      </>
    );
  }

  // --- Grid Mode (compact 2-col card) ---
  if (mode === "grid") {
    return (
      <>
        <article className="card-euro group flex flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="relative aspect-[4/3] cursor-pointer bg-parchment-dark text-left"
          >
            {game.image ? (
              <Image
                src={game.image}
                alt={primaryName}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-contain transition-transform duration-200 group-hover:scale-[1.05] p-1.5"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-ink-muted">
                No cover image
              </div>
            )}
            {game.type === 'Expansion' && (
              <div className="absolute left-1.5 top-1.5">
                <span className="rounded-full bg-euro-blue px-1.5 py-0.5 text-[9px] font-bold text-parchment">🧩 擴充</span>
              </div>
            )}
            {game.ownership === 'Played Elsewhere' && (
              <div className="absolute left-1.5 top-1.5">
                <span className="rounded-full bg-sepia px-1.5 py-0.5 text-[9px] font-bold text-parchment">☕ 外出</span>
              </div>
            )}
            <div className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-ink/60 px-1.5 py-0.5">
              <span className="text-[9px] font-bold text-brass">{game.complexity > 0 ? game.complexity.toFixed(1) : '-'}</span>
            </div>
          </button>

          <div className="flex flex-1 flex-col gap-1.5 p-3">
            <h2 className="font-heading text-xs font-bold leading-snug text-ink line-clamp-2">
              {primaryName}
            </h2>
            {hasChineseName && (
              <p className="truncate text-[10px] text-ink-muted">{game.name}</p>
            )}
            <div className="mt-auto flex flex-wrap gap-1 pt-1">
              <span className="rounded-full border border-grid-line bg-parchment px-1.5 py-0.5 text-[9px] font-medium text-ink-light">
                {game.minPlayers}–{game.maxPlayers}人
              </span>
              <span className="rounded-full border border-grid-line bg-parchment px-1.5 py-0.5 text-[9px] font-medium text-ink-light">
                {game.playTime > 0 ? `${game.playTime}分` : '?'}
              </span>
            </div>
          </div>
        </article>

        <PlayRecordModal
          open={open}
          onClose={() => setOpen(false)}
          gameId={game.pageId}
          gameName={primaryName}
          gameEnglishName={game.name}
          gameImage={game.image}
          comment={game.comment ?? ""}
          isAdmin={isAdmin}
          adminPassword={adminPassword}
        />
      </>
    );
  }

  // --- List Mode (compact horizontal row) ---
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-lg border border-grid-line bg-parchment-light p-3 text-left transition-colors hover:bg-parchment-dark"
      >
        {/* Thumbnail */}
        <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-md bg-parchment-dark">
          {game.image ? (
            <Image
              src={game.image}
              alt={primaryName}
              fill
              sizes="56px"
              className="object-contain p-1"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[9px] text-ink-muted">
              No img
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-sm font-bold text-ink">{primaryName}</h2>
            {game.type === 'Expansion' && (
              <span className="flex-shrink-0 rounded-full bg-euro-blue px-1.5 py-0.5 text-[8px] font-bold text-parchment">擴</span>
            )}
            {game.ownership === 'Played Elsewhere' && (
              <span className="flex-shrink-0 rounded-full bg-sepia px-1.5 py-0.5 text-[8px] font-bold text-parchment">外出</span>
            )}
          </div>
          {hasChineseName && (
            <p className="truncate text-[11px] text-ink-muted">{game.name}</p>
          )}
        </div>

        {/* Stats */}
        <div className="flex flex-shrink-0 items-center gap-2 text-[10px] text-ink-light">
          <span className="whitespace-nowrap rounded-full border border-grid-line bg-parchment px-2 py-0.5">
            {game.minPlayers}–{game.maxPlayers}人
          </span>
          <span className="whitespace-nowrap rounded-full border border-grid-line bg-parchment px-2 py-0.5">
            ⚖ {game.complexity > 0 ? game.complexity.toFixed(1) : '-'}
          </span>
        </div>
      </button>

      <PlayRecordModal
        open={open}
        onClose={() => setOpen(false)}
        gameId={game.pageId}
        gameName={primaryName}
        gameEnglishName={game.name}
        gameImage={game.image}
        comment={game.comment ?? ""}
        isAdmin={isAdmin}
        adminPassword={adminPassword}
      />
    </>
  );
}