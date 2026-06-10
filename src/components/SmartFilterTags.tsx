"use client";

import type { NotionGame, SmartFilterTag } from "@/lib/types";

const CORE_DESIGNERS = [
  "Vital Lacerda",
  "Jeroen Doumen",
  "Cole Wehrle",
  "Splotter Spellen",
];

export function createSmartFilterTags(
  applyMinWeight: (val: number) => void,
  applyMaxPlayTime: (val: number) => void
): SmartFilterTag[] {
  return [
    {
      id: "heavy-euro",
      label: "核心重策",
      icon: "🔥",
      description: "BGG Weight ≥ 3.5, 時間 ≥ 90分",
      filterFn: (game: NotionGame) =>
        game.complexity >= 3.5 && game.playTime >= 90,
      applyFilters: () => ({ minWeight: 3.5, maxPlayTime: 9999 }),
    },
    {
      id: "light-party",
      label: "輕鬆小品",
      icon: "🍻",
      description: "Weight < 2.2, 時間 ≤ 45分",
      filterFn: (game: NotionGame) =>
        (game.complexity > 0 && game.complexity < 2.2) &&
        game.playTime <= 45,
      applyFilters: () => ({ minWeight: 1, maxPlayTime: 45 }),
    },
    {
      id: "duel",
      label: "雙人對決",
      icon: "👥",
      description: "最佳/最大支援2人",
      filterFn: (game: NotionGame) =>
        game.maxPlayers === 2 ||
        (game.bestPlayers !== "" && game.bestPlayers.includes("2")),
      applyFilters: () => ({ minWeight: 1, maxPlayTime: 9999 }),
    },
    {
      id: "masterpieces",
      label: "經典典藏",
      icon: "✨",
      description: "特定設計師或評分≥8.0",
      filterFn: (game: NotionGame) =>
        game.rating >= 8.0 ||
        (game.comment !== undefined &&
          CORE_DESIGNERS.some((d) => game.comment?.includes(d))),
      applyFilters: () => ({ minWeight: 1, maxPlayTime: 9999 }),
    },
  ];
}

interface SmartFilterTagsProps {
  tags: SmartFilterTag[];
  activeTagId: string | null;
  onTagClick: (tag: SmartFilterTag | null) => void;
}

export default function SmartFilterTags({
  tags,
  activeTagId,
  onTagClick,
}: SmartFilterTagsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => {
        const isActive = activeTagId === tag.id;
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => onTagClick(isActive ? null : tag)}
            className={`filter-tag text-xs sm:text-sm ${
              isActive ? "filter-tag-active" : ""
            }`}
            title={tag.description}
          >
            <span aria-hidden="true">{tag.icon}</span>
            <span>{tag.label}</span>
          </button>
        );
      })}
    </div>
  );
}