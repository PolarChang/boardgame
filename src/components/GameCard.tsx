"use client";

import { useState } from "react";
import Image from "next/image";
import type { NotionGame } from "@/lib/types";
import PlayRecordModal from "./PlayRecordModal";

interface GameCardProps {
  game: NotionGame;
  isAdmin?: boolean;
  adminPassword?: string;
}

export default function GameCard({ game, isAdmin = false, adminPassword }: GameCardProps) {
  const [open, setOpen] = useState(false);
  const trimmedChineseName = (game.chineseName ?? "").trim();
  const hasChineseName = trimmedChineseName.length > 0;
  const primaryName = hasChineseName ? trimmedChineseName : game.name;

  return (
    <>
      <article className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative h-48 cursor-pointer bg-gray-100 text-left dark:bg-zinc-800"
        >
          {game.image ? (
            <Image
              src={game.image}
              alt={primaryName}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-contain transition-transform duration-200 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-gray-400">
              No cover image
            </div>
          )}
          <span className="absolute right-2 top-2 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold text-white shadow">
            {game.complexity.toFixed(1)}
          </span>
        </button>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <div>
            <h2 className="text-sm font-bold leading-snug text-gray-900">
              {primaryName}
            </h2>
            {hasChineseName ? (
              <p className="mt-1 text-xs text-gray-500">{game.name}</p>
            ) : null}
          </div>

          <div className="mt-auto flex flex-wrap gap-2">
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800">
              Best {game.bestPlayers || "—"} players
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {game.minPlayers}–{game.maxPlayers} players
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {game.playTime} min
            </span>
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800">
              Rating {game.rating.toFixed(1)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800"
          >
            📜 遊玩紀錄
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
