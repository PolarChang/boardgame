"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { PlayLog, PlayLogPlayer } from "@/lib/types";
import AddPlayLogModal from "@/components/AddPlayLogModal";

// Helper to render a tiny wax seal icon for winners
function WaxSeal({ size = "sm" }: { size?: "sm" | "xs" }) {
  const dim = size === "sm" ? "w-5 h-5" : "w-4 h-4";
  const fontSize = size === "sm" ? "text-[9px]" : "text-[7px]";
  return (
    <span
      className={`${dim} ${fontSize} wax-seal inline-flex items-center justify-center flex-shrink-0`}
      title="獲勝"
    >
      👑
    </span>
  );
}

// Helper to get winner name(s) from a play log
function getWinners(log: PlayLog): PlayLogPlayer[] {
  return log.players.filter((p) => p.isWinner);
}

/** Format a player's score for display – respects multi-score fields */
function formatPlayerScore(player: PlayLogPlayer): string {
  if (player.scores && player.scores.length > 0) {
    return player.scores.map((s) => `${s.label}:${s.value}`).join(" / ");
  }
  return String(player.score);
}

// Player stats aggregation
interface PlayerStats {
  name: string;
  totalPlays: number;
  totalWins: number;
  totalScore: number;
}

const AUTH_TOKEN_KEY = "boardgame_auth_token";
const AUTH_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export default function DashboardClient() {
  const [playLogs, setPlayLogs] = useState<PlayLog[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Admin auth (shared with game wall via localStorage)
  const [adminPassword, setAdminPassword] = useState("");
  const isAdmin = adminPassword !== "";
  const restoredFromStorage = useRef(false);

  // Restore auth token on mount
  useEffect(() => {
    if (restoredFromStorage.current) return;
    try {
      const raw = localStorage.getItem(AUTH_TOKEN_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.expiry > Date.now() && data.password) {
          setAdminPassword(data.password);
        } else {
          localStorage.removeItem(AUTH_TOKEN_KEY);
        }
      }
    } catch {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
    restoredFromStorage.current = true;
  }, []);

  // Player management state
  const [showPlayerManager, setShowPlayerManager] = useState(false);
  const [playerList, setPlayerList] = useState<string[]>([]);
  const [newPlayerName, setNewPlayerName] = useState("");

  // Refresh player list from Notion API
  const refreshPlayerList = useCallback(async () => {
    try {
      const res = await fetch("/api/players");
      if (res.ok) {
        const data = await res.json() as { id: string; name: string }[];
        setPlayerList(data.map((p) => p.name));
      }
    } catch (err) {
      console.error("Failed to fetch players:", err);
    }
  }, []);

  // Load players on mount
  useEffect(() => {
    refreshPlayerList();
  }, [refreshPlayerList]);

  // Ensure admin is authenticated (same mechanism as game wall 🔒)
  const ensureAdmin = useCallback(() => {
    if (adminPassword) return true;
    const pwd = window.prompt("請輸入管理員密碼：");
    if (pwd) {
      setAdminPassword(pwd);
      const token = {
        password: pwd,
        expiry: Date.now() + AUTH_DURATION_MS,
      };
      localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(token));
      return true;
    }
    return false;
  }, [adminPassword]);

  // Add a new player to Notion via API
  const handleAddPlayer = async () => {
    const name = newPlayerName.trim();
    if (!name) {
      window.alert("請輸入玩家名稱。");
      return;
    }
    if (!ensureAdmin()) return;

    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password: adminPassword }),
      });
      if (res.ok) {
        setNewPlayerName("");
        await refreshPlayerList();
      } else {
        window.alert("新增玩家失敗，請確認密碼正確。");
      }
    } catch {
      window.alert("新增玩家失敗，請檢查網路連線。");
    }
  };

  // Delete a player from Notion via API
  const handleDeletePlayer = async (name: string) => {
    if (!window.confirm(`確定從玩家庫移除「${name}」？`)) return;
    if (!ensureAdmin()) return;

    try {
      // First get the player ID
      const listRes = await fetch("/api/players");
      if (!listRes.ok) return;
      const players = await listRes.json() as { id: string; name: string }[];
      const target = players.find((p) => p.name === name);
      if (!target) return;

      const res = await fetch("/api/players", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: target.id, password: adminPassword }),
      });
      if (res.ok) {
        await refreshPlayerList();
      } else {
        window.alert("移除玩家失敗，請確認密碼正確。");
      }
    } catch {
      window.alert("移除玩家失敗，請檢查網路連線。");
    }
  };

  // Fetch play logs from Notion API
  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await fetch('/api/dashboard/plays');
        if (!res.ok) throw new Error('API responded with ' + res.status);
        const data = await res.json();
        setPlayLogs(data);
      } catch (err) {
        console.error('Failed to load dashboard play logs:', err);
        setError('無法從 Notion 載入戰績資料，請確認 Notion 連線正常。');
      } finally {
        setDataReady(true);
      }
    }
    fetchLogs();
  }, []);

  const refreshLogs = async () => {
    try {
      const res = await fetch('/api/dashboard/plays');
      if (res.ok) {
        const data = await res.json();
        setPlayLogs(data);
      }
    } catch {
      // silently retry
    }
  };

  // Aggregate player statistics
  const playerStats = useMemo(() => {
    const statsMap = new Map<string, PlayerStats>();
    for (const log of playLogs) {
      for (const player of log.players) {
        const existing = statsMap.get(player.name) || {
          name: player.name,
          totalPlays: 0,
          totalWins: 0,
          totalScore: 0,
        };
        existing.totalPlays += 1;
        existing.totalScore += player.score;
        if (player.isWinner) existing.totalWins += 1;
        statsMap.set(player.name, existing);
      }
    }
    return Array.from(statsMap.values()).sort(
      (a, b) => b.totalWins - a.totalWins || b.totalScore - a.totalScore
    );
  }, [playLogs]);

  // Overall stats
  const totalPlays = playLogs.length;
  const totalPlayers = playerStats.length;
  const avgScore =
    totalPlays > 0
      ? Math.round(
          playLogs.reduce(
            (sum, log) =>
              sum +
              log.players.reduce((s, p) => s + p.score, 0) /
                log.players.length,
            0
          ) / totalPlays
        )
      : 0;

  // Most played game
  const gamePlayCount = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const log of playLogs) {
      const existing = map.get(log.gameName) || {
        name: log.gameName,
        count: 0,
      };
      existing.count += 1;
      map.set(log.gameName, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [playLogs]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("確定刪除此筆遊玩紀錄？")) return;
    try {
      const res = await fetch(`/api/plays?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        refreshLogs();
      } else {
        window.alert('刪除失敗，請檢查權限。');
      }
    } catch {
      window.alert('刪除失敗，請檢查網路連線。');
    }
  };

  if (!dataReady) {
    return (
      <main className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8 parchment-bg min-h-screen">
        <p className="text-ink-muted text-sm">載入中...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8 parchment-bg min-h-screen">
        <div className="card-euro rounded-lg p-8 text-center">
          <p className="text-wax-red font-semibold mb-2">⚠️ {error}</p>
          <p className="text-sm text-ink-muted">
            請確認你的 Notion 資料庫有正確的遊玩紀錄。
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8 parchment-bg min-h-screen">
      {/* Page Header */}
      <header className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-wider text-ink">
            戰績表
          </h1>
          <p className="mt-1 text-sm text-ink-muted font-body">
            Game Ledger
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPlayerManager(!showPlayerManager)}
            className={`btn-euro rounded-lg px-4 py-2.5 text-sm ${
              showPlayerManager ? "bg-brass/20 border-brass" : ""
            }`}
          >
            👤 管理玩家
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="btn-wax-seal rounded-lg px-5 py-2.5 text-sm"
          >
            ✚ 新增遊玩紀錄
          </button>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card-euro rounded-lg p-5">
          <p className="font-heading text-xs font-semibold uppercase tracking-widest text-ink-light">
            總遊玩局數
          </p>
          <p className="mt-2 font-heading text-3xl font-bold text-ink">
            {totalPlays}
          </p>
        </div>
        <div className="card-euro rounded-lg p-5">
          <p className="font-heading text-xs font-semibold uppercase tracking-widest text-ink-light">
            記錄玩家數
          </p>
          <p className="mt-2 font-heading text-3xl font-bold text-ink">
            {totalPlayers}
          </p>
        </div>
        <div className="card-euro rounded-lg p-5">
          <p className="font-heading text-xs font-semibold uppercase tracking-widest text-ink-light">
            平均單局分數
          </p>
          <p className="mt-2 font-heading text-3xl font-bold text-ink">
            {avgScore}
          </p>
        </div>
        <div className="card-euro rounded-lg p-5">
          <p className="font-heading text-xs font-semibold uppercase tracking-widest text-ink-light">
            最常開的遊戲
          </p>
          <p className="mt-2 font-heading text-lg font-bold text-ink truncate">
            {gamePlayCount[0]?.name ?? "尚無資料"}
          </p>
          <p className="text-xs text-ink-muted">
            {gamePlayCount[0]?.count ?? 0} 局
          </p>
        </div>
      </div>

      {/* Player Management Panel (collapsible) */}
      {showPlayerManager && (
        <section className="card-euro rounded-lg p-5 mb-8">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-ink mb-4">
            👤 玩家庫管理
          </h2>

          {/* Add new player */}
          <div className="flex items-center gap-2 mb-4">
            <input
              type="text"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddPlayer();
              }}
              placeholder="輸入新玩家名稱..."
              className="input-euro rounded-lg flex-1 text-sm"
            />
            <button
              type="button"
              onClick={handleAddPlayer}
              className="btn-euro rounded-lg px-4 py-2 text-sm"
            >
              ➕ 新增
            </button>
          </div>

          {/* Player list */}
          <div className="flex flex-wrap gap-2">
            {playerList.length === 0 ? (
              <p className="text-xs text-ink-muted">尚無玩家資料，請先新增玩家。</p>
            ) : (
              playerList.map((name) => (
                <div
                  key={name}
                  className="flex items-center gap-2 bg-parchment border border-grid-line rounded-lg px-3 py-1.5"
                >
                  <span className="text-sm text-ink">{name}</span>
                  <button
                    type="button"
                    onClick={() => handleDeletePlayer(name)}
                    className="text-ink-muted hover:text-wax-red transition-colors"
                    aria-label={`移除 ${name}`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3.5 w-3.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            玩家資料儲存在 Notion 的玩家資料庫。點擊「新增」需要輸入管理員密碼。
          </p>
        </section>
      )}

      {/* Two column layout: Leaderboard + Game Frequency */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Player Leaderboard */}
        <section className="card-euro rounded-lg p-5">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-ink">
            🏆 玩家勝率排行榜
          </h2>
          <div className="mt-4 space-y-2">
            {playerStats.length === 0 ? (
              <p className="text-sm text-ink-muted">尚無資料</p>
            ) : (
              playerStats.slice(0, 10).map((stat, idx) => (
                <div
                  key={stat.name}
                  className="flex items-center justify-between gap-3 border-b border-grid-line py-2 last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-heading text-xs font-bold text-ink-muted w-5 text-right">
                      {idx + 1}.
                    </span>
                    {stat.totalWins > 0 && idx < 3 && <WaxSeal />}
                    <span className="truncate text-sm font-medium text-ink">
                      {stat.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-ink-light shrink-0">
                    <span>🏅 {stat.totalWins}勝</span>
                    <span>{stat.totalPlays}局</span>
                    <span className="font-semibold text-ink">
                      {stat.totalPlays > 0
                        ? Math.round((stat.totalWins / stat.totalPlays) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Game Frequency */}
        <section className="card-euro rounded-lg p-5">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-ink">
            📊 遊戲開局頻率
          </h2>
          <div className="mt-4 space-y-2">
            {gamePlayCount.length === 0 ? (
              <p className="text-sm text-ink-muted">尚無資料</p>
            ) : (
              gamePlayCount.slice(0, 8).map((game, idx) => {
                const maxCount = gamePlayCount[0]?.count || 1;
                const barWidth = (game.count / maxCount) * 100;
                return (
                  <div key={game.name} className="flex items-center gap-3">
                    <span className="font-heading text-xs font-bold text-ink-muted w-5 text-right shrink-0">
                      {idx + 1}.
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-ink truncate">{game.name}</span>
                        <span className="text-xs text-ink-muted shrink-0 ml-2">{game.count}局</span>
                      </div>
                      <div className="h-2 w-full bg-parchment-dark rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brass rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* The Ledger Table — full history */}
      <section className="card-euro rounded-lg overflow-hidden">
        <div className="border-b border-grid-line px-5 py-4">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-ink">
            📜 完整戰績明細帳
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="ledger-table min-w-[700px]">
            <thead>
              <tr>
                <th>日期</th>
                <th>遊戲</th>
                <th>玩家</th>
                <th>分數</th>
                <th>獲勝者</th>
                <th>地點</th>
                <th>局照</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {playLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-ink-muted py-8">
                    尚無遊玩紀錄，點擊「新增遊玩紀錄」開始記錄吧！
                  </td>
                </tr>
              ) : (
                playLogs.map((log) => {
                  const winners = getWinners(log);
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <tr key={log.id}>
                      <td className="font-mono text-xs whitespace-nowrap">{log.date}</td>
                      <td className="font-semibold whitespace-nowrap">{log.gameName}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {log.players.map((p, i) => (
                            <span
                              key={i}
                              className={`text-xs ${
                                p.isWinner ? "font-bold text-ink" : "text-ink-light"
                              }`}
                            >
                              {p.name}
                              {p.factionOrColor && (
                                <span className="text-ink-muted"> ({p.factionOrColor})</span>
                              )}
                              {i < log.players.length - 1 ? "，" : ""}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          {log.players.map((p, i) => (
                            <span
                              key={i}
                              className={`text-xs tabular-nums ${
                                p.isWinner ? "font-bold text-ink" : "text-ink-light"
                              }`}
                            >
                              {formatPlayerScore(p)}
                              {p.isWinner && <span className="ml-0.5 text-wax-red">👑</span>}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        {winners.length > 0 ? (
                          <div className="flex items-center gap-1">
                            <WaxSeal size="xs" />
                            <span className="text-sm font-bold text-wax-red">
                              {winners.map((w) => w.name).join(", ")}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="text-xs text-ink-muted">{log.location || "—"}</td>
                      <td>
                        {log.endgamePhotoUrl ? (
                          <button
                            type="button"
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="text-brass hover:text-brass-dark transition-colors text-xs font-semibold"
                          >
                            📷 檢視
                          </button>
                        ) : (
                          <span className="text-xs text-ink-muted">—</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="text-xs text-ink-muted hover:text-ink transition-colors mr-2"
                        >
                          {isExpanded ? "▲ 收起" : "▼ 詳情"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(log.id)}
                          className="text-xs text-ink-muted hover:text-wax-red transition-colors"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Expanded detail panels (Accordion) */}
        {playLogs.map((log) => {
          if (expandedLogId !== log.id) return null;
          return (
            <div
              key={`detail-${log.id}`}
              className="border-t border-grid-line bg-parchment-dark/30 px-5 py-6"
            >
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Photo display */}
                <div>
                  <h3 className="font-heading text-xs font-semibold uppercase tracking-wider text-ink-light mb-3">
                    終局盤面
                  </h3>
                  {log.endgamePhotoUrl ? (
                    <div className="vintage-frame inline-block">
                      <div className="relative w-full max-w-md aspect-[4/3]">
                        <Image
                          src={log.endgamePhotoUrl}
                          alt={`${log.gameName} 終局盤面`}
                          fill
                          className="object-contain"
                          sizes="500px"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 border border-dashed border-grid-line rounded bg-parchment">
                      <p className="text-xs text-ink-muted">尚無盤面照片</p>
                    </div>
                  )}
                </div>

                {/* Score breakdown */}
                <div>
                  <h3 className="font-heading text-xs font-semibold uppercase tracking-wider text-ink-light mb-3">
                    分數明細
                  </h3>
                  <div className="space-y-2">
                    {log.players.map((p, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between gap-4 rounded-lg border px-4 py-2.5 ${
                          p.isWinner
                            ? "border-brass bg-brass/5"
                            : "border-grid-line bg-parchment"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {p.isWinner && <WaxSeal size="xs" />}
                          <span
                            className={`text-sm ${
                              p.isWinner ? "font-bold text-ink" : "text-ink-light"
                            }`}
                          >
                            {p.name}
                          </span>
                          {p.factionOrColor && (
                            <span className="text-xs text-ink-muted">({p.factionOrColor})</span>
                          )}
                        </div>
                        <div className="flex flex-col items-end">
                          {p.scores && p.scores.length > 0 ? (
                            p.scores.map((s, si) => (
                              <span
                                key={si}
                                className={`font-heading text-sm ${
                                  p.isWinner ? "font-bold text-wax-red" : "text-ink"
                                }`}
                              >
                                {s.label}: {s.value}
                              </span>
                            ))
                          ) : (
                            <span
                              className={`font-heading text-base ${
                                p.isWinner ? "font-bold text-wax-red" : "text-ink"
                              }`}
                            >
                              {p.score} 分
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Notes & metadata */}
                  <div className="mt-4 space-y-1 text-xs text-ink-light">
                    {log.durationMinutes > 0 && <p>⏱ 遊戲時長：{log.durationMinutes} 分鐘</p>}
                    {log.location && <p>📍 地點：{log.location}</p>}
                    {log.notes && (
                      <p className="italic text-ink-muted mt-2">&ldquo;{log.notes}&rdquo;</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Add Play Log Modal */}
      {showAddModal && (
        <AddPlayLogModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
            refreshLogs();
          }}
        />
      )}
    </main>
  );
}