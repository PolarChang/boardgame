"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { Player, PlayRecord } from "@/lib/types";

interface PlayRecordModalProps {
  open: boolean;
  onClose: () => void;
  gameId: string;
  gameName: string;
  gameEnglishName?: string;
  gameImage?: string;
  comment?: string;
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
  gameEnglishName,
  gameImage,
  comment,
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

  const trimmedComment = (comment ?? "").trim();

  const hallOfFame = useMemo(() => {
    const escapeRegExp = (value: string) =>
      value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const extractMaxNumber = (text: string) => {
      const matches = Array.from(text.matchAll(/-?\d+(?:\.\d+)?/g)).map((m) =>
        Number(m[0])
      );
      if (matches.length === 0) return null;
      return Math.max(...matches);
    };

    const getBestScore = (play: PlayRecord) => {
      const raw = (play.scores ?? "").trim();
      if (!raw) return null;

      const perPlayer = play.players
        .map((p) => {
          const pattern = new RegExp(
            `${escapeRegExp(p.name)}\\s*[:：]?\\s*(-?\\d+(?:\\.\\d+)?)`
          );
          const m = raw.match(pattern);
          if (!m) return null;
          const score = Number(m[1]);
          if (Number.isNaN(score)) return null;
          return { playerName: p.name, score };
        })
        .filter(Boolean) as { playerName: string; score: number }[];

      if (perPlayer.length > 0) {
        return perPlayer.sort((a, b) => b.score - a.score)[0];
      }

      const maxNumber = extractMaxNumber(raw);
      if (maxNumber === null) return null;

      if (play.players.length === 1) {
        return { playerName: play.players[0]?.name || "—", score: maxNumber };
      }

      const playersLabel =
        play.players.length > 0
          ? play.players.map((p) => p.name).join("、")
          : "—";
      return { playerName: playersLabel, score: maxNumber };
    };

    const entries = plays
      .map((play) => {
        const best = getBestScore(play);
        if (!best) return null;
        return { play, ...best };
      })
      .filter(Boolean) as { play: PlayRecord; playerName: string; score: number }[];

    if (entries.length === 0) return null;

    return entries.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.play.date.localeCompare(a.play.date);
    })[0];
  }, [plays]);

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
        className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-6xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-950"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 sm:px-6 dark:border-gray-800">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              遊玩紀錄
            </p>
            <h2 className="mt-1 truncate text-base font-bold text-gray-900 sm:text-lg dark:text-gray-50">
              {gameName}
            </h2>
            {gameEnglishName && gameEnglishName !== gameName ? (
              <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
                {gameEnglishName}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-white"
          >
            關閉
          </button>
        </div>

        <div className="grid max-h-[80vh] grid-cols-1 overflow-hidden md:max-h-[78vh] md:grid-cols-2">
          <section className="flex flex-col border-b border-gray-200 md:border-b-0 md:border-r dark:border-gray-800">
            <div className="bg-gray-100 p-5 dark:bg-gray-900">
              <div className="mx-auto w-3/4">
                <div className="relative h-72 w-full overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-950 sm:h-80 md:h-96">
                  {gameImage ? (
                    <Image
                      src={gameImage}
                      alt={gameName}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-contain"
                      priority
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-gray-400 dark:text-gray-500">
                      No cover image
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto border-t border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                備註
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-200">
                {trimmedComment || "暫無介紹..."}
              </p>
            </div>
          </section>

          <section className="overflow-y-auto p-5 md:p-6">
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900/60 dark:bg-violet-950/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                👑 歷史最高分 (Hall of Fame)
              </p>
              {hallOfFame ? (
                <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                      {hallOfFame.playerName}
                    </p>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                      {hallOfFame.play.date || "—"}
                    </p>
                  </div>
                  <p className="text-2xl font-bold tracking-tight text-violet-700 dark:text-violet-200">
                    {hallOfFame.score}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  尚無可解析的分數資料
                </p>
              )}
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                  歷史紀錄
                </h3>
                <button
                  type="button"
                  onClick={refreshPlays}
                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-60 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                  disabled={playsLoading}
                >
                  重新整理
                </button>
              </div>

              {playsError ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
                  {playsError}
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {playsLoading ? (
                  <div className="space-y-2">
                    <div className="h-16 rounded-xl bg-gray-100 dark:bg-gray-900" />
                    <div className="h-16 rounded-xl bg-gray-100 dark:bg-gray-900" />
                    <div className="h-16 rounded-xl bg-gray-100 dark:bg-gray-900" />
                  </div>
                ) : plays.length === 0 ? (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900/30 dark:text-gray-300">
                    尚無遊玩紀錄
                  </div>
                ) : (
                  plays.map((play) => (
                    <article
                      key={play.id}
                      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                          {play.date || "—"}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {play.players.length > 0 ? (
                            play.players.map((p) => (
                              <span
                                key={p.id}
                                className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
                              >
                                {p.name}
                              </span>
                            ))
                          ) : (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                              未填玩家
                            </span>
                          )}
                        </div>
                      </div>
                      {play.scores ? (
                        <pre className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-200">
                          {play.scores}
                        </pre>
                      ) : (
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                          —
                        </p>
                      )}
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-800">
              {isAdmin ? (
                <>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                    新增紀錄
                  </h3>

                  <div className="mt-4 space-y-4">
                    {!adminPassword ? (
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Password
                        </span>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50 dark:focus:border-gray-200 dark:focus:ring-gray-200/10"
                          placeholder="輸入管理密碼"
                        />
                      </label>
                    ) : null}

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Date
                      </span>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50 dark:focus:border-gray-200 dark:focus:ring-gray-200/10"
                      />
                    </label>

                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Players
                        </p>
                        <button
                          type="button"
                          onClick={refreshPlayers}
                          className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-60 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                          disabled={playersLoading}
                        >
                          重新整理
                        </button>
                      </div>

                      {playersError ? (
                        <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
                          {playersError}
                        </div>
                      ) : null}

                      <div className="mt-2 flex flex-wrap gap-2">
                        {playersLoading ? (
                          <>
                            <div className="h-8 w-20 rounded-full bg-gray-100 dark:bg-gray-900" />
                            <div className="h-8 w-24 rounded-full bg-gray-100 dark:bg-gray-900" />
                            <div className="h-8 w-16 rounded-full bg-gray-100 dark:bg-gray-900" />
                          </>
                        ) : players.length === 0 ? (
                          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900/30 dark:text-gray-300">
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
                                    ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                                    : "bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                                }`}
                              >
                                {p.name}
                              </button>
                            );
                          })
                        )}
                      </div>

                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        已選：{selectedPlayersLabel || "—"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/30">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          type="text"
                          value={newPlayerName}
                          onChange={(e) => setNewPlayerName(e.target.value)}
                          className="w-full flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50 dark:focus:border-gray-200 dark:focus:ring-gray-200/10"
                          placeholder="快速新增玩家（輸入名字）"
                        />
                        <button
                          type="button"
                          onClick={submitNewPlayer}
                          disabled={
                            creatingPlayer ||
                            !newPlayerName.trim() ||
                            !effectivePassword
                          }
                          className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-950 dark:text-gray-50 dark:ring-gray-800 dark:hover:bg-gray-900"
                        >
                          New Player
                        </button>
                      </div>
                      {!effectivePassword ? (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          請先輸入管理密碼後才能新增玩家
                        </p>
                      ) : null}
                    </div>

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Scores
                      </span>
                      <textarea
                        value={scores}
                        onChange={(e) => setScores(e.target.value)}
                        rows={6}
                        className="w-full resize-none rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50 dark:focus:border-gray-200 dark:focus:ring-gray-200/10"
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
                      className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                    >
                      Submit
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/30">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                    查看模式
                  </p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    你目前沒有新增權限；如需新增紀錄，請以管理者身份開啟。
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
