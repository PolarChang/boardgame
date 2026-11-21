"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { KnowledgeGameSummary } from "@/lib/rules-knowledge";
import "./knowledge.css";

export default function KnowledgePage() {
  const [games, setGames] = useState<KnowledgeGameSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const restore = () => setQuery(new URLSearchParams(window.location.search).get("q") || "");
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  function search(value: string) {
    setQuery(value);
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("q", value); else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);
  }
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setGames(null);
    fetch("/api/rules/knowledge/games?public=1", { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("暫時無法讀取公開規則庫。");
        const data = await response.json();
        if (!Array.isArray(data.games) || data.games.some((game: KnowledgeGameSummary) => !game || typeof game.id !== "string" || typeof game.name !== "string")) throw new Error("規則庫資料格式不完整。");
        if (!controller.signal.aborted) setGames(data.games);
      })
      .catch(() => { if (!controller.signal.aborted) setError("暫時無法讀取公開規則庫。"); });
    return () => controller.abort();
  }, [attempt]);
  const results = games?.filter(game => game.name.toLowerCase().includes(query.trim().toLowerCase()));
  return <main className="knowledge-page knowledge-library mx-auto max-w-5xl px-4 py-8 sm:px-8">
    <header className="knowledge-library-heading">
      <div><h1 className="text-3xl font-semibold">規則庫</h1>
        <p className="knowledge-muted mt-3 leading-7">找到遊戲，閱讀已發布的規則，再核對原書來源。</p></div>
      <Link className="knowledge-link inline-flex min-h-11 items-center text-sm underline" href="/knowledge/admin">管理員入口</Link>
    </header>
    <Link className="knowledge-link mb-4 inline-flex min-h-11 items-center underline" href="/knowledge/records">已保存答案</Link>
    <section className="knowledge-library-search" aria-label="尋找規則">
    <label className="block font-semibold" htmlFor="library-search">搜尋遊戲</label>
    <div className="mt-2 flex items-center gap-3">
      <input id="library-search" name="q" type="search" autoComplete="off" placeholder="輸入遊戲名稱…" aria-describedby="library-search-help" className="input-euro min-h-11 min-w-0 flex-1 rounded-lg px-3" value={query} onChange={event => search(event.target.value)} />
      {query && <button className="knowledge-link shrink-0 px-2 underline" onClick={() => search("")}>清除搜尋</button>}
    </div>
    <p id="library-search-help" className="knowledge-muted mt-2 text-sm leading-6">搜尋已發布的遊戲名稱；閱讀規則不會啟動問答。</p>
    </section>
    {error ? <div className="knowledge-panel knowledge-error my-5 rounded-lg p-5"><p role="alert">{error} 請檢查連線後重試，搜尋內容會保留。</p><button className="btn-euro mt-3 rounded-lg px-4" onClick={() => setAttempt(value => value + 1)}>重新載入規則庫</button></div>
      : !games ? <p role="status" className="my-5">正在載入規則庫…</p>
      : <section className="mt-6" aria-label="規則搜尋結果">
        <p role="status" className="knowledge-muted text-sm">{query.trim() ? `找到 ${results?.length || 0} 款遊戲` : `共 ${games.length} 款遊戲可閱讀`}</p>
        {!results?.length ? <div className="knowledge-empty mt-4">
          <h2 className="font-semibold">{games.length ? "找不到符合的遊戲" : "目前還沒有已發布的規則"}</h2>
          <p className="mt-2 leading-7">{games.length ? "試試較短的名稱，或清除搜尋查看所有遊戲。" : "你可以先回到遊戲收藏，或稍後再來查看。"}</p>
          {games.length ? <button className="knowledge-link mt-3 px-3 underline" onClick={() => search("")}>查看所有遊戲</button> : <Link className="knowledge-link mt-3 inline-flex min-h-11 items-center underline" href="/">前往找遊戲</Link>}
        </div> : <ul className="knowledge-library-results mt-4">{results.map(game => <li key={game.id}>
          <Link aria-label={game.name} className="knowledge-library-game" href={`/knowledge/${encodeURIComponent(game.id)}/reader${query ? `?${new URLSearchParams({ library: query })}` : ""}`}>
            <span className="min-w-0"><strong className="block text-lg font-semibold">{game.name}</strong>{game.publisher && <span className="knowledge-muted mt-1 block text-sm">{game.publisher}</span>}</span>
            <span className="knowledge-link shrink-0 text-sm">閱讀規則 <span aria-hidden="true">→</span></span>
          </Link>
        </li>)}</ul>}
      </section>}
  </main>;
}
