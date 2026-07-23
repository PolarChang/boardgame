"use client";

import { useState } from "react";
import Image from "next/image";
import type { NotionGame } from "@/lib/types";
import type { ViewMode } from "./ViewToggle";
import PlayRecordModal from "./PlayRecordModal";

/* Vintage Analog: warm sepia overlay for images */
function VintageImage({ src, alt, fill, className, sizes }: { src: string; alt: string; fill?: boolean; className?: string; sizes?: string }) {
  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className="object-contain"
      />
      {/* Warm sepia tint overlay */}
      <div
        className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-20"
        style={{
          background:
            "linear-gradient(180deg, rgba(212,165,116,0.4) 0%, rgba(168,67,67,0.15) 100%)",
        }}
      />
      {/* Subtle vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, transparent 60%, rgba(45,36,30,0.25) 100%)",
        }}
      />
    </div>
  );
}

interface GameCardProps {
  game: NotionGame;
  mode?: ViewMode;
  isAdmin?: boolean;
  adminPassword?: string;
}

/** Format bestPlayers for display, e.g. "2,3" → "2–3人", "4" → "4人" */
function formatBestPlayers(raw: string): string | null {
  if (!raw || raw.trim() === "") return null;
  const trimmed = raw.trim();
  // Check if it's a range like "2-4"
  if (/^\d+-\d+$/.test(trimmed)) {
    return trimmed.replace("-", "–") + "人";
  }
  // Comma-separated list like "2,3,4"
  if (trimmed.includes(",")) {
    const parts = trimmed.split(",").map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return null;
    // For consecutive ranges like "2,3,4" compact to "2–4人"
    const nums = parts.map(Number).sort((a, b) => a - b);
    const isConsecutive = nums.every((n, i, arr) => i === 0 || n === arr[i - 1] + 1);
    if (isConsecutive && nums.length > 1) {
      return `${nums[0]}–${nums[nums.length - 1]}人`;
    }
    // For non-consecutive like "2,4" show as individual
    return parts.join("、") + "人";
  }
  // Single number
  return trimmed + "人";
}

export default function GameCard({ game, mode = "card", isAdmin = false, adminPassword }: GameCardProps) {
  const [open, setOpen] = useState(false);
  const trimmedChineseName = (game.chineseName ?? "").trim();
  const hasChineseName = trimmedChineseName.length > 0;
  const primaryName = hasChineseName ? trimmedChineseName : game.name;

  const bestPlayersDisplay = formatBestPlayers(game.bestPlayers);

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
              <VintageImage
                src={game.image}
                alt={primaryName}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className="transition-transform duration-200 group-hover:scale-[1.05] p-2"
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
              {bestPlayersDisplay && (
                <span className="rounded-full border border-brass/30 bg-brass/10 px-2 py-0.5 text-[10px] font-medium text-ink-light">
                  ★ {bestPlayersDisplay}
                </span>
              )}
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
            className="relative aspect-[3/2] cursor-pointer bg-parchment-dark text-left"
          >
            {game.image ? (
              <VintageImage
                src={game.image}
                alt={primaryName}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="transition-transform duration-200 group-hover:scale-[1.05] p-3"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-ink-muted">
                No cover image
              </div>
            )}
            {game.type === 'Expansion' && (
              <div className="absolute left-2 top-2">
                <span className="rounded-full bg-euro-blue px-2 py-0.5 text-[10px] font-bold text-parchment">🧩 擴充</span>
              </div>
            )}
            {game.ownership === 'Played Elsewhere' && (
              <div className="absolute left-2 top-2">
                <span className="rounded-full bg-sepia px-2 py-0.5 text-[10px] font-bold text-parchment">☕ 外出</span>
              </div>
            )}
            <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-ink/60 px-2 py-1">
              <span className="text-[10px] font-bold text-brass">{game.complexity > 0 ? game.complexity.toFixed(1) : '-'}</span>
            </div>
          </button>

          <div className="flex flex-1 flex-col gap-2 p-4">
            <h2 className="font-heading text-sm font-bold leading-snug text-ink line-clamp-2">
              {primaryName}
            </h2>
            {hasChineseName && (
              <p className="truncate text-xs text-ink-muted">{game.name}</p>
            )}
            <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
              <span className="rounded-full border border-grid-line bg-parchment px-2 py-0.5 text-[10px] font-medium text-ink-light">
                {game.minPlayers}–{game.maxPlayers}人
              </span>
              {bestPlayersDisplay && (
                <span className="rounded-full border border-brass/30 bg-brass/10 px-2 py-0.5 text-[10px] font-medium text-ink-light">
                  ★{bestPlayersDisplay}
                </span>
              )}
              <span className="rounded-full border border-grid-line bg-parchment px-2 py-0.5 text-[10px] font-medium text-ink-light">
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
            <VintageImage
              src={game.image}
              alt={primaryName}
              fill
              sizes="56px"
              className="p-1"
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
          {bestPlayersDisplay && (
            <span className="whitespace-nowrap rounded-full border border-brass/30 bg-brass/10 px-2 py-0.5">
              ★{bestPlayersDisplay}
            </span>
          )}
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