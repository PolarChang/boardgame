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
          className="relative h-48 cursor-pointer bg-gray-100 text-left"
        >
          {game.image ? (
            <Image
              src={game.image}
              alt={primaryName}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-contain transition-transform duration-200 group-hover:scale-[1.05]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-gray-400">
              No cover image
            </div>
          )}
          <div className="absolute left-2 top-2 flex flex-col gap-1">
            {game.type === 'Expansion' && (
                <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold text-white">🧩 擴充</span>
            )}
            {game.ownership === 'Played Elsewhere' && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">☕ 外出/朋友的</span>
            )}
          </div>
          <span className="absolute right-2 top-2 rounded-full bg-black/50 px-2.5 py-1 text-xs font-bold text-white shadow">
            {game.complexity > 0 ? game.complexity.toFixed(1) : '-'}
          </span>
        </button>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <div>
            <h2 className="text-sm font-bold leading-snug text-gray-900">
              {primaryName}
            </h2>
            {hasChineseName && (
              <p className="mt-0.5 text-xs text-gray-400">{game.name}</p>
            )}
          </div>

          <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
            <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600">
              {game.minPlayers}–{game.maxPlayers} 人
            </span>
            <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600">
              {game.playTime > 0 ? `${game.playTime} 分鐘` : '時間未定'}
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
