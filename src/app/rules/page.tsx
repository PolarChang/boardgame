"use client";

import { useState, useEffect, useCallback } from "react";

interface Game {
  pageId: string;
  name: string;
  chineseName: string;
  scoreFields: any;
}

interface QueryResult {
  rank: number;
  score: number;
  content: string;
}

export default function RulesPage() {
  const [query, setQuery] = useState("");
  const [selectedGame, setSelectedGame] = useState("");
  const [games, setGames] = useState<Game[]>([]);
  const [results, setResults] = useState<QueryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [topK, setTopK] = useState(5);

  // 載入遊戲清單
  useEffect(() => {
    fetch("/api/rules/games")
      .then((res) => res.json())
      .then((data) => {
        if (data.games) setGames(data.games);
      })
      .catch(() => setError("無法載入遊戲清單"));
  }, []);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const res = await fetch("/api/rules/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          game: selectedGame || undefined,
          top_k: topK,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.detail || "查詢失敗");
        return;
      }

      if (data.results) {
        setResults(data.results);
      } else if (data.content) {
        // LLM 模式：單一回應
        setResults([{ rank: 1, score: 1.0, content: data.content }]);
      }
    } catch (err) {
      setError("連線失敗，請確認規則引擎是否已啟動");
    } finally {
      setLoading(false);
    }
  }, [query, selectedGame, topK]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 sm:px-8">
      {/* 頁面標題 */}
      <div className="mb-10">
        <h1 className="font-heading text-3xl font-bold tracking-wide text-ink">
          規則查詢
        </h1>
        <p className="mt-2 text-sm text-ink-light">
          輸入你的桌遊規則問題，系統會從規則書中找出相關條文
        </p>
      </div>

      {/* 搜尋區域 */}
      <div className="brass-border-thin rounded-sm bg-parchment-light p-6">
        {/* 遊戲選擇 */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-light">
            選擇遊戲（可選）
          </label>
          <select
            value={selectedGame}
            onChange={(e) => setSelectedGame(e.target.value)}
            className="input-euro w-full rounded-sm"
          >
            <option value="">全部遊戲</option>
            {games.map((g) => (
              <option key={g.pageId} value={g.name}>
                {g.chineseName ? `${g.name}（${g.chineseName}）` : g.name}
              </option>
            ))}
          </select>
        </div>

        {/* 查詢輸入 */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-light">
            你的問題
          </label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="例如：如何計算分數？回合結束時要做什麼？"
            rows={3}
            className="input-euro w-full rounded-sm resize-none"
          />
        </div>

        {/* 結果數量 + 搜尋按鈕 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="text-xs text-ink-light">顯示筆數：</label>
            <select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="input-euro rounded-sm py-1 text-sm"
            >
              {[3, 5, 7, 10].map((n) => (
                <option key={n} value={n}>
                  {n} 筆
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="btn-euro-primary rounded-sm px-6 py-2 text-sm disabled:opacity-50"
          >
            {loading ? "查詢中…" : "查詢規則"}
          </button>
        </div>
      </div>

      {/* 錯誤訊息 */}
      {error && (
        <div className="mt-6 rounded-sm border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* 查詢結果 */}
      {results.length > 0 && (
        <div className="mt-8 space-y-4">
          <h2 className="font-heading text-lg font-semibold text-ink">
            查詢結果
          </h2>
          {results.map((r) => (
            <div
              key={r.rank}
              className="card-euro rounded-sm p-5"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-light">
                  第 {r.rank} 筆
                </span>
                <span className="text-xs text-ink-light">
                  相關度：{(r.score * 100).toFixed(1)}%
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                {r.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 空狀態提示 */}
      {!loading && !error && results.length === 0 && (
        <div className="mt-12 text-center">
          <div className="text-4xl">📜</div>
          <p className="mt-3 text-sm text-ink-light">
            輸入問題開始查詢桌遊規則
          </p>
        </div>
      )}
    </div>
  );
}