"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Player, PlayRecord } from "@/lib/types";

interface PlayRecordModalProps {
  open: boolean;
  onClose: () => void;
  gameId: string;
  gameName: string;
  isAdmin?: boolean;
  adminPassword?: string;
}

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function PlayRecordModal({
  open,
  onClose,
  gameId,
  gameName,
  isAdmin = false,
  adminPassword,
}: PlayRecordModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [plays, setPlays] = useState<PlayRecord[]>([]);
  const [playsLoading, setPlaysLoading] = useState(false);
  const [playsError, setPlaysError] = useState<string | null>(null);

  const [players, setPlayers] = useState<Player[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);

  const [date, setDate] = useState(todayISODate());
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [scores, setScores] = useState("");

  const [password, setPassword] = useState("");
  const effectivePassword = adminPassword ?? password;

  const [newPlayerName, setNewPlayerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [creatingPlayer, setCreatingPlayer] = useState(false);

  const playerById = useMemo(() => {
    return new Map(players.map((p) => [p.id, p]));
  }, [players]);

  const selectedPlayersLabel = useMemo(() => {
    const labels = selectedPlayerIds
      .map((id) => playerById.get(id)?.name)
      .filter(Boolean);
    return labels.join("、");
  }, [playerById, selectedPlayerIds]);

  const refreshPlays = useCallback(async () => {
    setPlaysLoading(true);
    setPlaysError(null);
    try {
      const url = `/api/plays?gameId=${encodeURIComponent(gameId)}`;
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error || `Failed to fetch plays (${res.status})`);
      }
      const data = (await res.json()) as PlayRecord[];
      setPlays(data);
    } catch (e) {
      setPlaysError(e instanceof Error ? e.message : "Failed to fetch plays");
    } finally {
      setPlaysLoading(false);
    }
  }, [gameId]);

  const refreshPlayers = useCallback(async () => {
    setPlayersLoading(true);
    setPlayersError(null);
    try {
      const res = await fetch("/api/players", { method: "GET" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(
          data?.error || `Failed to fetch players (${res.status})`
        );
      }
      const data = (await res.json()) as Player[];
      setPlayers(data);
    } catch (e) {
      setPlayersError(e instanceof Error ? e.message : "Failed to fetch players");
    } finally {
      setPlayersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    refreshPlays();
    if (isAdmin) {
      refreshPlayers();
      setDate(todayISODate());
      setSelectedPlayerIds([]);
      setScores("");
    }
  }, [open, isAdmin, refreshPlays, refreshPlayers]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const togglePlayer = (id: string) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const submitNewPlayer = async () => {
    const name = newPlayerName.trim();
    if (!name) return;
    if (!effectivePassword) return;

    setCreatingPlayer(true);
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password: effectivePassword }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error || `Failed to create player (${res.status})`);
      }
      const created = (await res.json()) as Player;
      setPlayers((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setSelectedPlayerIds((prev) =>
        prev.includes(created.id) ? prev : [...prev, created.id]
      );
      setNewPlayerName("");
    } catch (e) {
      setPlayersError(e instanceof Error ? e.message : "Failed to create player");
    } finally {
      setCreatingPlayer(false);
    }
  };

  const submitPlay = async () => {
    if (!effectivePassword) return;
    if (!gameId || !date || selectedPlayerIds.length === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/plays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          date,
          playerIds: selectedPlayerIds,
          scores,
          password: effectivePassword,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error || `Failed to create play (${res.status})`);
      }
      await refreshPlays();
      setScores("");
    } catch (e) {
      setPlaysError(e instanceof Error ? e.message : "Failed to create play");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              遊玩紀錄
            </p>
            <h2 className="mt-1 truncate text-base font-bold text-gray-900 sm:text-lg">
              {gameName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          >
            關閉
          </button>
        </div>

        <div className="grid max-h-[80vh] grid-cols-1 overflow-y-auto sm:max-h-[75vh] sm:grid-cols-2">
          <section className="border-b border-gray-200 p-5 sm:border-b-0 sm:border-r sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">歷史紀錄</h3>
              <button
                type="button"
                onClick={refreshPlays}
                className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                disabled={playsLoading}
              >
                重新整理
              </button>
            </div>

            {playsError ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {playsError}
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              {playsLoading ? (
                <div className="space-y-2">
                  <div className="h-16 rounded-xl bg-gray-100" />
                  <div className="h-16 rounded-xl bg-gray-100" />
                  <div className="h-16 rounded-xl bg-gray-100" />
                </div>
              ) : plays.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                  尚無遊玩紀錄
                </div>
              ) : (
                plays.map((play) => (
                  <article
                    key={play.id}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900">
                        {play.date || "—"}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {play.players.length > 0 ? (
                          play.players.map((p) => (
                            <span
                              key={p.id}
                              className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800"
                            >
                              {p.name}
                            </span>
                          ))
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            未填玩家
                          </span>
                        )}
                      </div>
                    </div>
                    {play.scores ? (
                      <pre className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                        {play.scores}
                      </pre>
                    ) : (
                      <p className="mt-2 text-sm text-gray-500">—</p>
                    )}
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="p-5 sm:p-6">
            {isAdmin ? (
              <>
                <h3 className="text-sm font-semibold text-gray-900">新增紀錄</h3>

                <div className="mt-4 space-y-4">
                  {!adminPassword ? (
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Password
                      </span>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                        placeholder="輸入管理密碼"
                      />
                    </label>
                  ) : null}

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Date
                    </span>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                    />
                  </label>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Players
                      </p>
                      <button
                        type="button"
                        onClick={refreshPlayers}
                        className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                        disabled={playersLoading}
                      >
                        重新整理
                      </button>
                    </div>

                    {playersError ? (
                      <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {playersError}
                      </div>
                    ) : null}

                    <div className="mt-2 flex flex-wrap gap-2">
                      {playersLoading ? (
                        <>
                          <div className="h-8 w-20 rounded-full bg-gray-100" />
                          <div className="h-8 w-24 rounded-full bg-gray-100" />
                          <div className="h-8 w-16 rounded-full bg-gray-100" />
                        </>
                      ) : players.length === 0 ? (
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                          尚無玩家，請先新增
                        </div>
                      ) : (
                        players.map((p) => {
                          const active = selectedPlayerIds.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => togglePlayer(p.id)}
                              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                                active
                                  ? "bg-gray-900 text-white"
                                  : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                              }`}
                            >
                              {p.name}
                            </button>
                          );
                        })
                      )}
                    </div>

                    <p className="mt-2 text-xs text-gray-500">
                      已選：{selectedPlayersLabel || "—"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        type="text"
                        value={newPlayerName}
                        onChange={(e) => setNewPlayerName(e.target.value)}
                        className="w-full flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                        placeholder="快速新增玩家（輸入名字）"
                      />
                      <button
                        type="button"
                        onClick={submitNewPlayer}
                        disabled={
                          creatingPlayer || !newPlayerName.trim() || !effectivePassword
                        }
                        className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        New Player
                      </button>
                    </div>
                    {!effectivePassword ? (
                      <p className="mt-2 text-xs text-gray-500">
                        請先輸入管理密碼後才能新增玩家
                      </p>
                    ) : null}
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Scores
                    </span>
                    <textarea
                      value={scores}
                      onChange={(e) => setScores(e.target.value)}
                      rows={6}
                      className="w-full resize-none rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                      placeholder="可輸入分數、戰報、或備註（自由格式）"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={submitPlay}
                    disabled={
                      submitting ||
                      !effectivePassword ||
                      !date ||
                      selectedPlayerIds.length === 0
                    }
                    className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Submit
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-900">查看模式</p>
                <p className="mt-1 text-sm text-gray-600">
                  你目前沒有新增權限；如需新增紀錄，請以管理者身份開啟。
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
