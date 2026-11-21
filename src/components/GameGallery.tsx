"use client";
import "./collection.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { SlidersHorizontal, Shuffle, LockKeyhole, BookOpen } from "lucide-react";
import type { NotionGame, SmartFilterTag } from "@/lib/types";
import FilterBar from "./FilterBar";
import GameCard from "./GameCard";
import { createSmartFilterTags } from "./SmartFilterTags";
import SearchBar from "./SearchBar";
import ViewToggle from "./ViewToggle";
import type { ViewMode } from "./ViewToggle";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { verifyCollectionAdmin } from "@/lib/collection-admin";

interface GameGalleryProps {
  initialGames: NotionGame[];
}

type SortBy = "rating_desc" | "weight_desc" | "weight_asc";

function getMaxPlayTimeLimit() {
  return 180; // 3 hours
}

const AUTH_TOKEN_KEY = "boardgame_auth_token";
const AUTH_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

const VIEW_MODE_KEY = "boardgame_view_mode";

function getGridClass(mode: ViewMode): string {
  switch (mode) {
    case "card":
      return "grid-cols-1";
    case "grid":
      return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
    case "list":
      return "grid-cols-1"; // list mode uses flex layout instead
  }
}

function getContainerClass(mode: ViewMode): string {
  if (mode === "list") {
    return "flex flex-col gap-2";
  }
  return `grid gap-6 p-6 sm:p-8 ${getGridClass(mode)}`;
}

export default function GameGallery({ initialGames }: GameGalleryProps) {
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [maxPlayTime, setMaxPlayTime] = useState(() =>
    getMaxPlayTimeLimit()
  );
  const [minWeight, setMinWeight] = useState(1);
  const [sortBy, setSortBy] = useState<SortBy>("rating_desc");
  const [adminPassword, setAdminPassword] = useState("");
  const isAdmin = adminPassword !== "";
  const restoredFromStorage = useRef(false);
  const adminAuthRequest = useRef(0);
  const [adminChecking, setAdminChecking] = useState(false);

  // Search & View Mode
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>(VIEW_MODE_KEY, "grid");

  // On mount, restore auth token from localStorage
  useEffect(() => {
    if (restoredFromStorage.current) return;
    try {
      const raw = localStorage.getItem(AUTH_TOKEN_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.expiry > Date.now() && data.password) {
          const version = ++adminAuthRequest.current;
          void verifyCollectionAdmin(data.password).then(valid => {
            if (version !== adminAuthRequest.current) return;
            if (valid) setAdminPassword(data.password);
            else localStorage.removeItem(AUTH_TOKEN_KEY);
          }).catch(() => { /* Keep the saved state for a later service retry. */ });
        } else {
          localStorage.removeItem(AUTH_TOKEN_KEY);
        }
      }
    } catch {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
    restoredFromStorage.current = true;
  }, []);
  const [newBggId, setNewBggId] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [pickedGame, setPickedGame] = useState<NotionGame | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  // Filters
  const [showExpansions, setShowExpansions] = useState(false);
  const [ownershipFilter, setOwnershipFilter] = useState<'Owned' | 'All'>('Owned');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [bestPlayerCountOnly, setBestPlayerCountOnly] = useState(false);

  // Smart Filter Tags
  const [activeSmartFilterId, setActiveSmartFilterId] = useState<string | null>(null);

  const smartFilterTags = useMemo(
    () => createSmartFilterTags(setMinWeight, setMaxPlayTime),
    []
  );

  const maxPlayTimeLimit = useMemo(() => {
    return getMaxPlayTimeLimit();
  }, []);

  useEffect(() => {
    setMaxPlayTime((prev) => {
      if (prev >= 9999) return prev; // keep "3小時以上" selection
      return Math.min(prev, maxPlayTimeLimit);
    });
  }, [maxPlayTimeLimit]);

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSmartFilterClick = useCallback(
    (tag: SmartFilterTag | null) => {
      if (tag === null) {
        setActiveSmartFilterId(null);
        setMinWeight(1);
        setMaxPlayTime(maxPlayTimeLimit);
        return;
      }
      setActiveSmartFilterId(tag.id);
      const filters = tag.applyFilters();
      setMinWeight(filters.minWeight);
      setMaxPlayTime(filters.maxPlayTime);
    },
    [maxPlayTimeLimit]
  );

  const searchedGames = useMemo(() => {
    if (!searchTerm.trim()) return initialGames;
    const searchLower = searchTerm.toLowerCase();
    return initialGames.filter((game) => {
      return (
        (game.chineseName ?? "").toLowerCase().includes(searchLower) ||
        game.name.toLowerCase().includes(searchLower)
      );
    });
  }, [initialGames, searchTerm]);

  const filteredGames = useMemo(() => {
    let games = searchedGames.filter((game) => {
      if (!showExpansions && game.type === 'Expansion') return false;
      if (ownershipFilter === 'Owned' && game.ownership !== 'Owned') return false;

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

      // Best player count toggle: only show games where playerCount is in bestPlayers
      if (bestPlayerCountOnly && playerCount !== null) {
        if (!game.bestPlayers || game.bestPlayers.trim() === "") return false;
        const bestNums = game.bestPlayers.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        if (!bestNums.includes(playerCount)) return false;
      }

      return true;
    }).sort((a, b) => {
      const ratingValue = (g: NotionGame) => g.rating || 0;
      const weightValueAsc = (g: NotionGame) =>
        g.complexity === 0 ? Number.POSITIVE_INFINITY : g.complexity;
      const weightValueDesc = (g: NotionGame) =>
        g.complexity === 0 ? -1 : g.complexity;

      if (sortBy === "rating_desc") {
        return ratingValue(b) - ratingValue(a);
      }
      if (sortBy === "weight_desc") {
        return weightValueDesc(b) - weightValueDesc(a);
      }
      return weightValueAsc(a) - weightValueAsc(b);
    });

    // Additional smart filter logic after basic filters
    if (activeSmartFilterId) {
      const activeTag = smartFilterTags.find((t) => t.id === activeSmartFilterId);
      if (activeTag) {
        games = games.filter(activeTag.filterFn);
      }
    }

    return games;
  }, [searchedGames, playerCount, maxPlayTime, minWeight, sortBy, showExpansions, ownershipFilter, activeSmartFilterId, smartFilterTags, bestPlayerCountOnly]);

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
      if (e.key === "Escape") closePicker();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pickerOpen, closePicker]);

  const showEmptySearch = searchTerm.trim().length > 0 && filteredGames.length === 0;

  const resetFilters = () => {
    setSearchTerm("");
    setPlayerCount(null);
    setMaxPlayTime(maxPlayTimeLimit);
    setMinWeight(1);
    setShowExpansions(false);
    setOwnershipFilter('Owned');
    setBestPlayerCountOnly(false);
    setActiveSmartFilterId(null);
  };

  return (
    <main className="collection-workspace min-h-screen parchment-bg">
      {/* Header */}
      <header className="collection-intro border-b border-grid-line bg-parchment-light px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-heading text-xl font-bold tracking-wider text-ink">
              找遊戲
            </h1>
            <p className="text-xs text-ink-muted font-body" role="status">
              {filteredGames.length} / {initialGames.length} 款
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={isAdmin ? "管理員已登入" : "管理員登入"}
              disabled={adminChecking}
              onClick={async () => {
                const pwd = window.prompt("請輸入管理員密碼：");
                if (pwd) {
                  const version = ++adminAuthRequest.current;
                  setAdminChecking(true);
                  try {
                    const valid = await verifyCollectionAdmin(pwd);
                    if (version !== adminAuthRequest.current) return;
                    if (!valid) { window.alert("管理密碼不正確，請使用目前正式環境的管理密碼"); return; }
                  } catch {
                    window.alert("無法驗證管理登入，請稍後重試");
                    return;
                  } finally { setAdminChecking(false); }
                  setAdminPassword(pwd);
                  const token = {
                    password: pwd,
                    expiry: Date.now() + AUTH_DURATION_MS,
                  };
                  localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(token));
                }
              }}
              className="collection-admin text-ink-muted hover:text-ink transition-colors"
            >
              <LockKeyhole size={18} aria-hidden="true" />
            </button>
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    adminAuthRequest.current++;
                    setAdminPassword("");
                    localStorage.removeItem(AUTH_TOKEN_KEY);
                  }}
                  className="text-xs text-ink-muted hover:text-wax-red transition-colors"
                  title="鎖定 / 登出管理員"
                >
                  鎖定
                </button>
              </>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className="mx-auto mt-4 max-w-7xl flex gap-2">
            <input 
              placeholder="BGG ID" 
              value={newBggId} 
              onChange={e => setNewBggId(e.target.value)}
              className="input-euro rounded-lg px-3 py-2 text-sm w-32"
            />
            <button 
              disabled={isAdding}
              onClick={async () => {
                  setIsAdding(true);
                  await fetch('/api/games', {
                      method: 'POST',
                      body: JSON.stringify({ bggId: newBggId, password: adminPassword })
                  });
                  setNewBggId('');
                  setIsAdding(false);
                  window.location.reload();
              }}
              className="btn-euro-primary rounded-lg px-4 py-2 text-sm"
            >
              {isAdding ? '處理中...' : '➕ 新增桌遊'}
            </button>
          </div>
        )}
      </header>

      <section className="collection-shortcuts" aria-label="開始探索">
        <div className="collection-shortcut-actions">
          <button type="button" onClick={pickOne} disabled={filteredGames.length === 0} className="collection-primary"><Shuffle size={18} aria-hidden="true" />幫我選一款</button>
          <Link href="/knowledge"><BookOpen size={18} aria-hidden="true" />前往規則庫</Link>
          <Link href="/meet/index.html">策略桌遊聚會</Link>
          {isAdmin && <Link href="/meet/index.html?manage=1">團務後台</Link>}
        </div>
      </section>

      {/* Sticky Control Bar: Search + View Toggle */}
      <div className="collection-controls sticky top-0 z-30 border-b border-grid-line bg-parchment-light/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-6 py-3">
          <div className="flex-1">
            <SearchBar
              searchTerm={searchTerm}
              onChange={setSearchTerm}
              onClear={() => setSearchTerm("")}
            />
          </div>
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
          <button type="button" aria-expanded={isFilterExpanded} aria-controls="collection-filters" onClick={() => setIsFilterExpanded(!isFilterExpanded)} className="collection-filter-toggle md:hidden"><SlidersHorizontal size={18} aria-hidden="true" />篩選條件</button>
        </div>
      </div>

      {/* Filter Bar */}
      <div id="collection-filters" className={`${isFilterExpanded ? 'block' : 'hidden'} md:block`}>
        <FilterBar
          playerCount={playerCount}
          maxPlayTime={maxPlayTime}
          maxPlayTimeLimit={maxPlayTimeLimit}
          minWeight={minWeight}
          sortBy={sortBy}
          showExpansions={showExpansions}
          ownershipFilter={ownershipFilter}
          bestPlayerCountOnly={bestPlayerCountOnly}
          smartFilterTags={smartFilterTags}
          activeSmartFilterId={activeSmartFilterId}
          onSmartFilterClick={handleSmartFilterClick}
          onPlayerCountChange={setPlayerCount}
          onMaxPlayTimeChange={setMaxPlayTime}
          onMinWeightChange={setMinWeight}
          onSortByChange={setSortBy}
          onShowExpansionsChange={setShowExpansions}
          onOwnershipFilterChange={setOwnershipFilter}
          onBestPlayerCountOnlyChange={setBestPlayerCountOnly}
        />
      </div>

      {/* Game Grid */}
      {showEmptySearch ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
          <p className="text-sm text-ink-muted">找不到符合「{searchTerm}」的桌遊，換個關鍵字試試？</p>
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="btn-euro rounded-lg px-4 py-2 text-xs"
          >
            清除搜尋
          </button>
          <button type="button" onClick={resetFilters} className="collection-reset">重設所有條件</button>
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
          <p className="text-sm text-ink-muted">沒有符合篩選條件的遊戲。</p>
          <button type="button" onClick={resetFilters} className="collection-reset">重設所有條件</button>
        </div>
      ) : (
        <section
          data-testid="game-grid-section"
          className={`mx-auto max-w-7xl ${getContainerClass(viewMode)}`}
        >
          {filteredGames.map((game) => (
            <GameCard
              key={game.pageId}
              game={game}
              mode={viewMode}
              isAdmin={isAdmin}
              adminPassword={adminPassword}
            />
          ))}
        </section>
      )}

      {/* Scroll to top */}
      {showScrollTop ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="返回頂端"
          className="collection-scroll-top fixed bottom-4 right-4 h-11 w-11 rounded-full bg-parchment text-ink shadow-euro border border-grid-line hover:border-brass transition-colors"
        >
          ↑
        </button>
      ) : null}
      
      {/* Picker Modal */}
      {pickerOpen && pickedGame && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 transition-opacity duration-200 ${
            pickerVisible ? "opacity-100" : "opacity-0"
          }`}
          onClick={closePicker}
        >
          <div
            className={`max-h-[85vh] w-full max-w-md transform overflow-y-auto bg-parchment-light p-6 shadow-euro-lg transition-all duration-200 brass-border ${
              pickerVisible ? "scale-100" : "scale-95"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {pickedGame.image && (
              <div className="relative mb-4 aspect-[3/2] w-full overflow-hidden vintage-frame">
                <Image
                  src={pickedGame.image}
                  alt={pickedGame.name}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 400px"
                />
              </div>
            )}
            <h2 className="font-heading text-xl font-bold text-ink">{pickedGame.chineseName || pickedGame.name}</h2>
            {pickedGame.chineseName && (
              <p className="mt-1 text-sm text-ink-muted">{pickedGame.name}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-ink-light">
              {pickedGame.minPlayers > 0 && pickedGame.maxPlayers > 0 && (
                <span className="rounded-full border border-grid-line bg-parchment px-2.5 py-1">
                  👥 {pickedGame.minPlayers}-{pickedGame.maxPlayers}人
                </span>
              )}
              {pickedGame.playTime ? (
                <span className="rounded-full border border-grid-line bg-parchment px-2.5 py-1">⏱ {pickedGame.playTime}分</span>
              ) : null}
              {pickedGame.complexity ? (
                <span className="rounded-full border border-grid-line bg-parchment px-2.5 py-1">⚖ {pickedGame.complexity.toFixed(1)}</span>
              ) : null}
              {pickedGame.rating ? (
                <span className="rounded-full border border-grid-line bg-parchment px-2.5 py-1">⭐ {pickedGame.rating.toFixed(1)}</span>
              ) : null}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={repick}
                className="btn-euro-primary flex-1 rounded-lg px-4 py-2.5 text-sm"
              >
                🎲 換一個
              </button>
              <button
                type="button"
                onClick={closePicker}
                className="btn-euro flex-1 rounded-lg px-4 py-2.5 text-sm"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
