"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import EditorialLogin from "@/components/EditorialLogin";
import { BookOpen, Search, Plus, ArrowRight, Users, Clock, Library } from "lucide-react";
import "../knowledge.css";
import type { KnowledgeGameInput, KnowledgeGameStatus, KnowledgeGameSummary, KnowledgeNotionGame } from "@/lib/rules-knowledge";

const statusLabels: Record<KnowledgeGameStatus, string> = {
  draft: "草稿",
  review: "待審核",
  published: "已發布",
};

function statusClass(status: KnowledgeGameStatus) {
  return status === "published"
    ? "bg-emerald-100 text-emerald-800"
    : status === "review"
      ? "bg-amber-100 text-amber-800"
      : "bg-stone-200 text-stone-700";
}

export default function KnowledgePage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [gamesError, setGamesError] = useState("");
  const [notionError, setNotionError] = useState("");
  const [games, setGames] = useState<KnowledgeGameSummary[]>([]);
  const [notionGames, setNotionGames] = useState<KnowledgeNotionGame[]>([]);
  const [selectedNotionPageId, setSelectedNotionPageId] = useState("");
  const [loadingGames, setLoadingGames] = useState(true);
  const [loadingNotionGames, setLoadingNotionGames] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const authenticated = useRef(false);
  const gameRequest = useRef(0);

  const selectedNotionGame = useMemo(
    () => notionGames.find((item) => item.pageId === selectedNotionPageId),
    [notionGames, selectedNotionPageId],
  );

  const loadGames = useCallback(async () => {
    const request = ++gameRequest.current;
    setLoadingGames(true);
    setGamesError("");
    try {
      const response = await fetch("/api/rules/knowledge/games", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 401 ? "請先登入，讀取你的私人規則庫。" : data.error || "無法載入遊戲清單");
      if (gameRequest.current === request) setGames(data.games || []);
    } catch (cause) {
      if (gameRequest.current === request) setGamesError(cause instanceof Error ? cause.message : "無法載入遊戲清單");
    } finally {
      if (gameRequest.current === request) setLoadingGames(false);
    }
  }, []);

  const onLogin = useCallback((active: boolean) => {
    const changed = authenticated.current !== active;
    authenticated.current = active;
    if (active) void loadGames();
    else if (changed) { setGames([]); void loadGames(); }
  }, [loadGames]);

  const loadNotionGames = useCallback(async () => {
    setLoadingNotionGames(true);
    setNotionError("");
    try {
      const response = await fetch("/api/rules/knowledge/notion-games", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "無法載入 Notion 遊戲清單");
      setNotionGames(data.games || []);
    } catch (cause) {
      setNotionError(cause instanceof Error ? cause.message : "無法載入 Notion 遊戲清單");
    } finally {
      setLoadingNotionGames(false);
    }
  }, []);

  useEffect(() => { void loadGames(); void loadNotionGames(); }, [loadGames, loadNotionGames]);

  const filteredGames = games.filter((game) =>
    (statusFilter === "all" || game.status === statusFilter) &&
    `${game.name} ${game.id}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );


  async function createGame() {
    if (!selectedNotionGame) return;
    setCreating(true);
    setError("");
    setNotice("");
    const payload: KnowledgeGameInput = {
      id: selectedNotionGame.knowledgeGameId,
      name: selectedNotionGame.name,
      publisher: selectedNotionGame.publisher || null,
      designer: selectedNotionGame.designer,
      player_count: selectedNotionGame.player_count,
      play_time: selectedNotionGame.play_time,
      complexity: selectedNotionGame.complexity,
      status: "draft",
    };

    try {
      const response = await fetch("/api/rules/knowledge/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || data.error || "建立遊戲失敗");

      setNotice(`已建立「${data.name}」的規則知識庫對應，現在可進入整理稿管理。`);
      await loadGames();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "建立遊戲失敗");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="knowledge-page mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">規則管理</h1><Link href="/knowledge" className="text-brass underline">公開規則庫</Link>
      </header>
      <details className="mb-4 rounded-lg border border-grid-line px-4">
        <summary className="min-h-11 cursor-pointer py-3">管理員登入</summary>
        <EditorialLogin onLogin={onLogin} embedded />
      </details>
      {error && <div role="alert" className="knowledge-error mb-6 rounded-lg border p-4 text-sm">{error}</div>}
      {notice && !error && <div role="status" className="knowledge-notice mb-6 rounded-lg border p-4 text-sm">{notice}</div>}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.85fr)]">
        <section className="knowledge-panel min-w-0 rounded-xl p-5 sm:p-6" aria-labelledby="games-heading" aria-busy={loadingGames}>
          <div className="flex items-center justify-between gap-3">
            <h2 id="games-heading" className="flex items-center gap-2 text-lg font-semibold"><Library size={21} aria-hidden="true" />遊戲規則庫</h2>
            <span className="knowledge-muted text-sm">{loadingGames || gamesError ? "—" : `${games.length} 個遊戲`}</span>
          </div>
          <div className="relative mt-5">
            <Search size={18} className="pointer-events-none absolute left-3 top-3.5 knowledge-muted" aria-hidden="true" />
            <input aria-label="搜尋遊戲" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋遊戲名稱或 ID…" className="input-euro min-h-11 w-full rounded-lg pl-10" />
          </div>
          <div className="my-4 flex flex-wrap gap-2" role="group" aria-label="依狀態篩選">
            {[["all", "全部"], ...Object.entries(statusLabels)].map(([value, label]) => <button key={value} type="button" aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)} className={`knowledge-filter ${statusFilter === value ? "is-active" : ""}`}>{label}<span className="ml-2 text-xs">{loadingGames || gamesError ? "—" : games.filter((game) => value === "all" || game.status === value).length}</span></button>)}
          </div>
          {loadingGames ? <div role="status" className="knowledge-empty"><BookOpen className="mx-auto mb-3 motion-safe:animate-pulse" aria-hidden="true" />正在載入遊戲規則庫…</div>
            : gamesError ? <div role="alert" className="knowledge-empty"><p>{gamesError}</p><button className="btn-euro mt-4 rounded-lg" onClick={() => void loadGames()}>重新載入遊戲</button></div>
            : filteredGames.length === 0 ? <div className="knowledge-empty"><BookOpen size={32} className="mx-auto mb-3" aria-hidden="true" /><h3 className="font-semibold">{games.length ? "找不到符合條件的遊戲" : "從第一款遊戲開始"}</h3><p className="mt-2 text-sm">{games.length ? "試試其他關鍵字，或清除篩選條件。" : "從 Notion 收藏加入遊戲，就能建立專屬規則庫。"}</p>{games.length > 0 ? <button className="btn-euro mt-4 rounded-lg" onClick={() => { setQuery(""); setStatusFilter("all"); }}>清除搜尋與篩選</button> : <button type="button" className="btn-euro mt-4 rounded-lg" onClick={() => { const panel = document.getElementById("add-game") as HTMLDetailsElement | null; if (panel) { panel.open = true; panel.querySelector("summary")?.focus(); } }}>加入遊戲<ArrowRight size={16} aria-hidden="true" /></button>}</div>
            : <><p role="status" className="knowledge-muted mb-3 text-xs">顯示 {filteredGames.length} 個遊戲</p><ul className="space-y-3">{filteredGames.map((item) => <li key={item.id} className={`knowledge-game rounded-lg border p-4`}>
              <div className="flex items-start justify-between gap-3"><h3 className="min-w-0 break-words text-base font-semibold">{item.name}</h3><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(item.status)}`}>{statusLabels[item.status]}</span></div>
              <div className="knowledge-muted mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm"><span className="inline-flex items-center gap-1.5"><Users size={15} aria-hidden="true" />{item.player_count.min}–{item.player_count.max} 人</span><span className="inline-flex items-center gap-1.5"><Clock size={15} aria-hidden="true" />{item.play_time.min}–{item.play_time.max} 分</span></div>
              <div className="mt-4 flex flex-wrap items-center gap-2"><Link href={`/knowledge/${encodeURIComponent(item.id)}/reader`} className="btn-euro-primary inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm" aria-label={`查找 ${item.name} 規則`}>查找規則<ArrowRight size={16} aria-hidden="true" /></Link><Link href={`/knowledge/${encodeURIComponent(item.id)}/manage`} className="knowledge-link inline-flex min-h-11 items-center px-3 text-sm font-semibold" aria-label={`管理 ${item.name} 整理稿`}>整理稿管理</Link></div>
            </li>)}</ul></>}
        </section>

        <div className="space-y-8">
          <details id="add-game" className="knowledge-panel scroll-mt-24 rounded-xl p-5 sm:p-6">
            <summary className="min-h-11 cursor-pointer font-semibold"><Plus size={18} className="mr-2 inline" aria-hidden="true" />從 Notion 加入遊戲</summary>
            {notionError && <div role="alert" className="knowledge-error mt-4 rounded-lg p-3 text-sm">{notionError}<button className="btn-euro mt-2 rounded-lg" onClick={() => void loadNotionGames()}>重新載入收藏</button></div>}
            {!loadingNotionGames && !notionError && notionGames.length === 0 && <p className="knowledge-muted mt-4 text-sm">Notion 收藏目前沒有可加入的遊戲。</p>}
            <label className="mt-5 block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-light">Notion 收藏遊戲</span>
              <select disabled={loadingNotionGames || creating} value={selectedNotionPageId} onChange={(event) => setSelectedNotionPageId(event.target.value)} className="input-euro w-full rounded-sm">
                <option value="">{loadingNotionGames ? "載入 Notion 遊戲中…" : "選擇遊戲"}</option>
                {notionGames.map((item) => <option key={item.pageId} value={item.pageId}>{item.chineseName ? `${item.name}（${item.chineseName}）` : item.name}</option>)}
              </select>
            </label>
            {selectedNotionGame && <div className="mt-4 rounded-sm border border-brass/40 bg-brass/5 p-4 text-sm text-ink">
              <div className="font-semibold">{selectedNotionGame.name}</div>
              <div className="mt-1 text-ink-light">規則庫 ID：{selectedNotionGame.knowledgeGameId} · {selectedNotionGame.player_count.min}–{selectedNotionGame.player_count.max} 人 · {selectedNotionGame.play_time.min}–{selectedNotionGame.play_time.max} 分</div>
              {selectedNotionGame.designer.length > 0 && <div className="mt-1 text-ink-light">設計師：{selectedNotionGame.designer.join("、")}</div>}
            </div>}
            <button type="button" onClick={() => void createGame()} disabled={!selectedNotionGame || creating} className="btn-euro-primary mt-5 w-full rounded-sm px-5 py-2 disabled:opacity-50">{creating ? "建立對應中…" : "新增至規則知識庫"}</button>
          </details>
          <a href="/templates/rules-editorial-v1.md" download className="inline-flex min-h-11 items-center text-sm text-brass underline">下載整理稿範本</a>
        </div>
      </div>
    </main>
  );
}
