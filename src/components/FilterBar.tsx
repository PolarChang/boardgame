"use client";

const PLAYER_OPTIONS = [
  { label: "1人", value: 1 },
  { label: "2人", value: 2 },
  { label: "3人", value: 3 },
  { label: "4人", value: 4 },
  { label: "5+人", value: 5 },
] as const;

type SortBy = "rating_desc" | "weight_desc" | "weight_asc";

interface FilterBarProps {
  playerCount: number | null;
  maxPlayTime: number;
  maxPlayTimeLimit: number;
  minWeight: number;
  sortBy: SortBy;
  showExpansions: boolean;
  ownershipFilter: 'Owned' | 'All';
  onSmartPick: () => void;
  onPlayerCountChange: (value: number | null) => void;
  onMaxPlayTimeChange: (value: number) => void;
  onMinWeightChange: (value: number) => void;
  onSortByChange: (value: SortBy) => void;
  onShowExpansionsChange: (value: boolean) => void;
  onOwnershipFilterChange: (value: 'Owned' | 'All') => void;
}

export default function FilterBar({
  playerCount,
  maxPlayTime,
  maxPlayTimeLimit,
  minWeight,
  sortBy,
  showExpansions,
  ownershipFilter,
  onSmartPick,
  onPlayerCountChange,
  onMaxPlayTimeChange,
  onMinWeightChange,
  onSortByChange,
  onShowExpansionsChange,
  onOwnershipFilterChange,
}: FilterBarProps) {
  return (
    <div className="border-b border-gray-200 bg-white px-6 py-4 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 lg:flex-row lg:items-end lg:gap-8">
        <div className="flex-[2]">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            玩家人數
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onPlayerCountChange(null)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                playerCount === null
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex-1 text-sm text-gray-700">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            最長時間：{maxPlayTime} 分鐘
          </span>
          <input
            type="range"
            min={15}
            max={maxPlayTimeLimit}
            step={15}
            value={maxPlayTime}
            onChange={(e) => onMaxPlayTimeChange(Number(e.target.value))}
            className="w-full accent-gray-900"
          />
        </label>

        <label className="flex-1 text-sm text-gray-700">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            最低複雜度：{minWeight.toFixed(1)}
          </span>
          <input
            type="range"
            min={1}
            max={5}
            step={0.1}
            value={minWeight}
            onChange={(e) => onMinWeightChange(Number(e.target.value))}
            className="w-full accent-gray-900"
          />
        </label>

        <label className="flex-1 text-sm text-gray-700">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Sort by
          </span>
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as SortBy)}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
          >
            <option value="rating_desc">BGG 評分（高 → 低）</option>
            <option value="weight_desc">複雜度（重 → 輕）</option>
            <option value="weight_asc">複雜度（輕 → 重）</option>
          </select>
        </label>

        <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-gray-900" checked={showExpansions} onChange={(e) => onShowExpansionsChange(e.target.checked)} />
                <span>🧩 包含擴充</span>
            </label>
            <select value={ownershipFilter} onChange={(e) => onOwnershipFilterChange(e.target.value as 'Owned' | 'All')} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm">
                <option value="Owned">🏠 我的收藏 (Owned)</option>
                <option value="All">🌍 全部紀錄 (All)</option>
            </select>
        </div>

        <div className="flex lg:justify-end">
          <button
            type="button"
            onClick={onSmartPick}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500 active:scale-[0.98] lg:w-auto"
          >
            <span aria-hidden="true">🎲</span>
            幫我選
          </button>
        </div>
      </div>
    </div>
  );
}
