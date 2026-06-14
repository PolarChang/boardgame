"use client";

import { X, Search } from "lucide-react";

interface SearchBarProps {
  searchTerm: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

export default function SearchBar({ searchTerm, onChange, onClear }: SearchBarProps) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <Search size={16} className="text-ink-muted" />
      </div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => onChange(e.target.value)}
        placeholder="搜尋桌遊名稱（中文/英文）..."
        enterKeyHint="search"
        className="input-euro w-full rounded-lg border border-grid-line bg-parchment py-2 pl-9 pr-9 text-sm text-ink placeholder:text-ink-muted focus:border-brass focus:outline-none focus:ring-1 focus:ring-brass"
      />
      {searchTerm && (
        <button
          type="button"
          onClick={onClear}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-muted hover:text-ink transition-colors"
          title="清除搜尋"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}