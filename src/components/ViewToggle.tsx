"use client";

import { LayoutGrid, Grid3X3, List } from "lucide-react";

export type ViewMode = "card" | "grid" | "list";

interface ViewToggleProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const modes: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
  { mode: "card", icon: <LayoutGrid size={18} />, label: "卡片" },
  { mode: "grid", icon: <Grid3X3 size={18} />, label: "網格" },
  { mode: "list", icon: <List size={18} />, label: "清單" },
];

export default function ViewToggle({ viewMode, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-grid-line bg-parchment p-0.5">
      {modes.map(({ mode, icon, label }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
            viewMode === mode
              ? "bg-euro-blue text-parchment shadow-sm"
              : "text-ink-muted hover:text-ink hover:bg-parchment-dark"
          }`}
          title={label}
        >
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}