"use client";

import { X } from "lucide-react";
import type { SmartFilterTag } from "@/lib/types";
import SmartFilterTags from "./SmartFilterTags";

const PLAYER_OPTIONS = [
  { label: "1人", value: 1 },
  { label: "2人", value: 2 },
  { label: "3人", value: 3 },
  { label: "4人", value: 4 },
  { label: "5+人", value: 5 },
] as const;

type SortBy = "rating_desc" | "weight_desc" | "weight_asc";

interface MobileFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  playerCount: number | null;
  maxPlayTime: number;
  maxPlayTimeLimit: number;
  minWeight: number;
  sortBy: SortBy;
  showExpansions: boolean;
  ownershipFilter: 'Owned' | 'All';
  bestPlayerCountOnly: boolean;
  smartFilterTags: SmartFilterTag[];
  activeSmartFilterId: string | null;
  onSmartFilterClick: (tag: SmartFilterTag | null) => void;
  onPlayerCountChange: (value: number | null) => void;
  onMaxPlayTimeChange: (value: number) => void;
  onMinWeightChange: (value: number) => void;
  onSortByChange: (value: SortBy) => void;
  onShowExpansionsChange: (value: boolean) => void;
  onOwnershipFilterChange: (value: 'Owned' | 'All') => void;
  onBestPlayerCountOnlyChange: (value: boolean) => void;
}

export default function MobileFilterDrawer({
  open,
  onClose,
  playerCount,
  maxPlayTime,
  maxPlayTimeLimit,
  minWeight,
  sortBy,
  showExpansions,
  ownershipFilter,
  bestPlayerCountOnly,
  smartFilterTags,
  activeSmartFilterId,
  onSmartFilterClick,
  onPlayerCountChange,
  onMaxPlayTimeChange,
  onMinWeightChange,
  onSortByChange,
  onShowExpansionsChange,
  onOwnershipFilterChange,
  onBestPlayerCountOnlyChange,
}: MobileFilterDrawerProps) {
  return (
    <>
      {/* Overlay */}
      <div
        className={`filter-drawer-overlay ${open ? "open" : ""}`}
        onClick={onClose}
      />
      {/* Drawer */}
      <div className={`filter-drawer ${open ? "open" : ""}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-grid-line bg-parchment-light px-4 py-3">
          <span className="font-heading text-xs font-semibold uppercase tracking-widest text-ink-light">
            篩選設定
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted hover:text-ink transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-col gap-6 p-4">
          {/* Smart Filter Tags */}
          <div>
            <p className="mb-2 font-heading text-xs font-semibold uppercase tracking-widest text-ink-light">
              策劃精選
            </p>
            <SmartFilterTags
              tags={smartFilterTags}
              activeTagId={activeSmartFilterId}
              onTagClick={onSmartFilterClick}
            />
          </div>

          {/* Player Count */}
          <div>
            <p className="mb-2 font-heading text-xs font-semibold uppercase tracking-widest text-ink-light">
              玩家人數
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onPlayerCountChange(null)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  playerCount === null
                    ? "bg-ink text-parchment"
                    : "border border-grid-line bg-transparent text-ink-light hover:border-brass hover:bg-brass/5 hover:text-ink"
                }`}
              >
                全部
              </button>
              {PLAYER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    onPlayerCountChange(
                      playerCount === option.value ? null : option.value
                    )
                  }
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    playerCount === option.value
                      ? "bg-ink text-parchment"
                      : "border border-grid-line bg-transparent text-ink-light hover:border-brass hover:bg-brass/5 hover:text-ink"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {playerCount !== null && (
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-ink-light hover:text-ink transition-colors">
                <input
                  type="checkbox"
                  className="accent-brass h-3.5 w-3.5"
                  checked={bestPlayerCountOnly}
                  onChange={(e) => onBestPlayerCountOnlyChange(e.target.checked)}
                />
                <span>只顯示最佳人數</span>
              </label>
            )}
          </div>

          {/* Max Play Time */}
          <label className="text-sm">
            <span className="mb-2 block font-heading text-xs font-semibold uppercase tracking-widest text-ink-light">
              最長時間：{maxPlayTime >= 9999 ? "∞" : `${maxPlayTime} 分鐘`}
            </span>
            <input
              type="range"
              min={15}
              max={maxPlayTimeLimit}
              step={15}
              value={Math.min(maxPlayTime, maxPlayTimeLimit)}
              onChange={(e) => onMaxPlayTimeChange(Number(e.target.value))}
              className="w-full accent-euro-blue"
            />
          </label>

          {/* Min Weight */}
          <label className="text-sm">
            <span className="mb-2 block font-heading text-xs font-semibold uppercase tracking-widest text-ink-light">
              最低複雜度：{minWeight.toFixed(1)}
            </span>
            <input
              type="range"
              min={1}
              max={5}
              step={0.1}
              value={minWeight}
              onChange={(e) => onMinWeightChange(Number(e.target.value))}
              className="w-full accent-euro-blue"
            />
          </label>

          {/* Sort */}
          <label className="text-sm">
            <span className="mb-2 block font-heading text-xs font-semibold uppercase tracking-widest text-ink-light">
              排序方式
            </span>
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value as SortBy)}
              className="input-euro w-full rounded-lg"
            >
              <option value="rating_desc">BGG 評分（高 → 低）</option>
              <option value="weight_desc">複雜度（重 → 輕）</option>
              <option value="weight_asc">複雜度（輕 → 重）</option>
            </select>
          </label>

          {/* Toggles */}
          <div className="flex flex-col gap-3 text-sm">
            <label className="flex cursor-pointer items-center gap-2 text-ink-light hover:text-ink transition-colors">
              <input
                type="checkbox"
                className="accent-euro-blue h-4 w-4"
                checked={showExpansions}
                onChange={(e) => onShowExpansionsChange(e.target.checked)}
              />
              <span>包含擴充</span>
            </label>
            <select
              value={ownershipFilter}
              onChange={(e) =>
                onOwnershipFilterChange(e.target.value as 'Owned' | 'All')
              }
              className="input-euro rounded-lg text-sm"
            >
              <option value="Owned">我的收藏</option>
              <option value="All">全部紀錄</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );
}