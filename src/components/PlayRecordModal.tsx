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
  viewerId?: string | null;
}

interface PlayerScoreEntry {
  playerId: string;
  score: number;
  isWinner: boolean;
  firstPlay: boolean;
}

interface RecordFormState {
  date: string;
  location: string;
  notes: string;
  isCoop: boolean;
  coopScenario: string;
  coopDifficulty: string;
  coopResult: "Win" | "Loss";
  coopFailReason: string;
  playerScores: PlayerScoreEntry[];
}

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function createEmptyPlayerScore(): PlayerScoreEntry {
  return { playerId: "", score: 0, isWinner: false, firstPlay: false };
}

function createInitialFormState(): RecordFormState {
  return {
    date: todayISODate(),
    location: "",
    notes: "",
    isCoop: false,
    coopScenario: "",
    coopDifficulty: "",
    coopResult: "Win",
    coopFailReason: "",
    playerScores: [createEmptyPlayerScore()],
  };
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
  viewerId,
}: PlayRecordModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [plays, setPlays] = useState<PlayRecord[]>([]);
  const [playsLoading, setPlaysLoading] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [activeTab, setActiveTab] = useState<"history" | "add">("history");
  const [recordForm, setRecordForm] = useState<RecordFormState>(createInitialFormState());
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const effectivePassword = adminPassword ?? password;

  const filteredPlays = useMemo(() => {
    if (!viewerId) return plays;
    return plays.filter((p) => p.players.some((pl) => pl.id === viewerId));
  }, [plays, viewerId]);

  const refreshPlays = useCallback(async () => {
    setPlaysLoading(true);
    try {
      const res = await fetch(`/api/plays?gameId=${encodeURIComponent(gameId)}`);
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`API Error (${res.status}):`, errorText);
        throw new Error(`無法載入遊玩紀錄，伺服器回應: ${res.status}`);
      }
      const data = (await res.json()) as PlayRecord[];
      setPlays(data);
    } finally {
      setPlaysLoading(false);
    }
  }, [gameId]);

  const refreshPlayers = useCallback(async () => {
    try {
      const res = await fetch("/api/players");
      if (res.ok) {
        const data = (await res.json()) as Player[];
        setPlayers(data);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    if (open) {
      refreshPlays();
      if (isAdmin) refreshPlayers();
    }
  }, [open, refreshPlays, refreshPlayers, isAdmin]);

  // Reset form when switching to add tab
  useEffect(() => {
    if (activeTab === "add") {
      setRecordForm(createInitialFormState());
    }
  }, [activeTab]);

  const parseScore = (text: string) => {
    const lines = text.split("\n");
    const playerScoresMap: Record<string, number> = {};
    lines.forEach((line) => {
      const match = line.match(/[:：]\s*(\d+)/);
      if (match) {
        const score = parseInt(match[1]);
        playerScoresMap[line] = score;
      }
    });
    return playerScoresMap;
  };

  const getWinnerInfo = (play: PlayRecord) => {
    const parsed = parseScore(play.scores);
    const entries = Object.entries(parsed);
    if (entries.length === 0) return null;
    let maxScore = -1;
    let winner = "";
    entries.forEach(([name, score]) => {
      if (score > maxScore) {
        maxScore = score;
        winner = name;
      }
    });
    return { winner, maxScore };
  };

  const hallOfFame = useMemo(() => {
    let max = -1;
    let record: PlayRecord | null = null;
    plays.forEach((p) => {
      const info = getWinnerInfo(p);
      if (info && info.maxScore > max) {
        max = info.maxScore;
        record = p;
      }
    });
    return record ? { record, max } : null;
  }, [plays]);

  // ---- Dynamic Player Array Handlers ----
  const addPlayer = () => {
    setRecordForm((prev) => ({
      ...prev,
      playerScores: [...prev.playerScores, createEmptyPlayerScore()],
    }));
  };

  const removePlayer = (index: number) => {
    setRecordForm((prev) => {
      if (prev.playerScores.length <= 1) return prev;
      return {
        ...prev,
        playerScores: prev.playerScores.filter((_, i) => i !== index),
      };
    });
  };

  const updatePlayerScore = (index: number, updates: Partial<PlayerScoreEntry>) => {
    setRecordForm((prev) => ({
      ...prev,
      playerScores: prev.playerScores.map((entry, i) =>
        i === index ? { ...entry, ...updates } : entry
      ),
    }));
  };

  // ---- Submit Handler ----
  const submitPlay = async () => {
    if (recordForm.playerScores.length === 0) return;
    setSubmitting(true);
    try {
      const playerScores = recordForm.playerScores.map((entry) => ({
        playerId: entry.playerId,
        score: entry.score,
        isWinner: recordForm.isCoop ? (recordForm.coopResult === "Win") : entry.isWinner,
        firstPlay: entry.firstPlay,
      }));

      const payload: Record<string, unknown> = {
        gameId,
        date: recordForm.date,
        playerScores,
        notes: recordForm.notes || undefined,
      };
      if (recordForm.location) payload.location = recordForm.location;
      if (recordForm.notes) payload.notes = recordForm.notes;

      const res = await fetch("/api/plays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await refreshPlays();
        setRecordForm(createInitialFormState());
        setActiveTab("history");
      } else {
        const errText = await res.text();
        console.error("Submit failed:", errText);
        alert(`提交失敗: ${errText}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    // 1. Overlay (Background Mask)
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="absolute inset-0" onClick={onClose} />

      {/* 2. Modal Container */}
      <div className="relative max-w-4xl w-[90vw] max-h-[85vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* 3. Modal Header (Fixed at top) */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-white">
          <h2 className="text-lg font-bold text-gray-900">
            遊玩紀錄 — {gameName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="關閉"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
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

        {/* 4. Tab Navigation */}
        <div className="flex border-b shrink-0 bg-gray-50">
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`px-6 py-3 text-sm font-semibold transition-colors relative ${
              activeTab === "history"
                ? "text-gray-900 bg-white"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            遊玩歷史
            {activeTab === "history" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
            )}
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab("add")}
              className={`px-6 py-3 text-sm font-semibold transition-colors relative ${
                activeTab === "add"
                  ? "text-gray-900 bg-white"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              新增紀錄
              {activeTab === "add" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
              )}
            </button>
          )}
        </div>

        {/* Body: image + content in a horizontal split */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Image & Comment */}
          <div className="hidden md:flex md:w-1/3 flex-col p-6 bg-gray-50 overflow-y-auto">
            <div className="relative w-3/4 mx-auto mb-6 shrink-0">
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-gray-100">
                {gameImage && (
                  <Image
                    src={gameImage}
                    alt={gameName}
                    fill
                    className="object-contain"
                    sizes="300px"
                  />
                )}
              </div>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed text-center">
              {comment || "暫無介紹"}
            </p>
          </div>

          {/* Right: Content Area */}
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Tab 1: History View */}
            {activeTab === "history" && (
              <>
                {/* Summary Bar */}
                <div className="flex items-center gap-4 px-6 py-3 border-b bg-gray-50 shrink-0 flex-wrap">
                  <span className="text-sm font-semibold text-gray-700">
                    👑 歷史最高分: {hallOfFame?.max ?? "無"}
                  </span>
                </div>

                {/* Scrollable Content Area */}
                <div className="overflow-auto flex-grow p-5 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-400 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <div className="min-w-max">
                    {playsLoading ? (
                      <div className="text-center text-gray-500 py-10">
                        載入中...
                      </div>
                    ) : filteredPlays.length === 0 ? (
                      <div className="py-16 text-center text-gray-500">
                        目前還沒有這款遊戲的遊玩紀錄。
                      </div>
                    ) : (
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <th className="px-3 py-2">日期</th>
                            <th className="px-3 py-2">玩家</th>
                            <th className="px-3 py-2">分數</th>
                            <th className="px-3 py-2">備註</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPlays.map((play) => {
                            const winner = getWinnerInfo(play);
                            return (
                              <tr
                                key={play.id}
                                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                              >
                                <td className="px-3 py-3 text-sm font-mono text-gray-600 whitespace-nowrap">
                                  {play.date}
                                </td>
                                <td className="px-3 py-3 text-sm text-gray-800">
                                  {play.players.map((p) => p.name).join(", ") ||
                                    "—"}
                                </td>
                                <td className="px-3 py-3 text-sm font-medium">
                                  {play.scores
                                    .split(",")
                                    .map((s, i) => {
                                      const isWinner =
                                        winner &&
                                        s.includes(":") &&
                                        winner.winner.includes(
                                          s.split(":")[0]
                                        );
                                      return (
                                        <span
                                          key={i}
                                          className={
                                            isWinner
                                              ? "text-yellow-600 font-bold"
                                              : "text-gray-700"
                                          }
                                        >
                                          {s.trim()}
                                          {isWinner ? " 👑" : ""}
                                          {i <
                                          play.scores.split(",").length - 1
                                            ? ", "
                                            : ""}
                                        </span>
                                      );
                                    })}
                                </td>
                                <td className="px-3 py-3 text-sm text-gray-400">
                                  —
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Tab 2: Add Record View */}
            {activeTab === "add" && isAdmin && (
              <div className="overflow-auto flex-grow p-5 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-400 [&::-webkit-scrollbar-thumb]:rounded-full">
                <div className="space-y-6 max-w-xl">
                  {/* Basic Info Section */}
                  <div className="space-y-4">
                    <h3 className="text-base font-semibold text-gray-800">
                      基本資訊
                    </h3>

                    {/* Co-op Mode Toggle */}
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={recordForm.isCoop}
                        onChange={(e) =>
                          setRecordForm((prev) => ({
                            ...prev,
                            isCoop: e.target.checked,
                          }))
                        }
                        className="rounded"
                      />
                      🤝 合作遊戲模式
                    </label>

                    {/* Date */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-gray-500">
                        日期
                      </label>
                      <input
                        type="date"
                        value={recordForm.date}
                        onChange={(e) =>
                          setRecordForm((prev) => ({
                            ...prev,
                            date: e.target.value,
                          }))
                        }
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                      />
                    </div>

                    {/* Location */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-gray-500">
                        地點
                      </label>
                      <input
                        type="text"
                        value={recordForm.location}
                        onChange={(e) =>
                          setRecordForm((prev) => ({
                            ...prev,
                            location: e.target.value,
                          }))
                        }
                        placeholder="例如: 桌遊店、家裡..."
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                      />
                    </div>

                    {/* Notes */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-gray-500">
                        備註
                      </label>
                      <textarea
                        value={recordForm.notes}
                        onChange={(e) =>
                          setRecordForm((prev) => ({
                            ...prev,
                            notes: e.target.value,
                          }))
                        }
                        placeholder="遊玩心得、特殊規則..."
                        rows={3}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent resize-none"
                      />
                    </div>
                  </div>

                  {/* Co-op Specific Fields (shown only when isCoop is true) */}
                  {recordForm.isCoop && (
                    <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h3 className="text-base font-semibold text-gray-800">
                        合作模式設定
                      </h3>

                      {/* Scenario / Level */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-gray-500">
                          關卡 / 劇本
                        </label>
                        <input
                          type="text"
                          value={recordForm.coopScenario}
                          onChange={(e) =>
                            setRecordForm((prev) => ({
                              ...prev,
                              coopScenario: e.target.value,
                            }))
                          }
                          placeholder="例如: 第3關、瘟疫危機-普通難度..."
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                        />
                      </div>

                      {/* Difficulty */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-gray-500">
                          難度設定
                        </label>
                        <input
                          type="text"
                          value={recordForm.coopDifficulty}
                          onChange={(e) =>
                            setRecordForm((prev) => ({
                              ...prev,
                              coopDifficulty: e.target.value,
                            }))
                          }
                          placeholder="例如: 簡單、普通、困難、傳奇..."
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                        />
                      </div>

                      {/* Team Result */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-gray-500">
                          團隊結果
                        </label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                            <input
                              type="radio"
                              name="coopResult"
                              checked={recordForm.coopResult === "Win"}
                              onChange={() =>
                                setRecordForm((prev) => ({
                                  ...prev,
                                  coopResult: "Win",
                                }))
                              }
                              className="accent-gray-900"
                            />
                            勝利 🎉
                          </label>
                          <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                            <input
                              type="radio"
                              name="coopResult"
                              checked={recordForm.coopResult === "Loss"}
                              onChange={() =>
                                setRecordForm((prev) => ({
                                  ...prev,
                                  coopResult: "Loss",
                                }))
                              }
                              className="accent-gray-900"
                            />
                            失敗 💀
                          </label>
                        </div>
                      </div>

                      {/* Failure Reason */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-gray-500">
                          敗北原因 / 備註
                        </label>
                        <input
                          type="text"
                          value={recordForm.coopFailReason}
                          onChange={(e) =>
                            setRecordForm((prev) => ({
                              ...prev,
                              coopFailReason: e.target.value,
                            }))
                          }
                          placeholder="例如: 牌庫耗盡、時間到..."
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}

                  {/* Player Scores Section */}
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold text-gray-800">
                      參與玩家
                    </h3>

                    {recordForm.playerScores.map((entry, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200"
                      >
                        {/* Player Select */}
                        <select
                          value={entry.playerId}
                          onChange={(e) =>
                            updatePlayerScore(index, {
                              playerId: e.target.value,
                            })
                          }
                          className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent min-w-[120px]"
                        >
                          <option value="">選擇玩家</option>
                          {players.map((player) => (
                            <option key={player.id} value={player.id}>
                              {player.name}
                            </option>
                          ))}
                        </select>

                        {/* Competitive Mode: Score + Is Winner */}
                        {!recordForm.isCoop && (
                          <>
                            {/* Score Input */}
                            <input
                              type="number"
                              value={entry.score}
                              onChange={(e) =>
                                updatePlayerScore(index, {
                                  score: parseInt(e.target.value) || 0,
                                })
                              }
                              placeholder="分數"
                              className="border border-gray-300 rounded-lg px-2 py-2 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                            />

                            {/* isWinner Checkbox */}
                            <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer shrink-0">
                              <input
                                type="checkbox"
                                checked={entry.isWinner}
                                onChange={(e) =>
                                  updatePlayerScore(index, {
                                    isWinner: e.target.checked,
                                  })
                                }
                                className="rounded"
                              />
                              贏家
                            </label>
                          </>
                        )}

                        {/* firstPlay Checkbox (shown in both modes) */}
                        <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={entry.firstPlay}
                            onChange={(e) =>
                              updatePlayerScore(index, {
                                firstPlay: e.target.checked,
                              })
                            }
                            className="rounded"
                          />
                          初玩
                        </label>

                        {/* Remove Button */}
                        {recordForm.playerScores.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePlayer(index)}
                            className="text-red-400 hover:text-red-600 transition-colors p-1 shrink-0"
                            aria-label="移除玩家"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Add Player Button */}
                    <button
                      type="button"
                      onClick={addPlayer}
                      className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors px-3 py-2 rounded-lg border border-dashed border-gray-300 hover:border-gray-500 w-full justify-center"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      + 新增玩家
                    </button>
                  </div>

                  {/* Password (if not pre-configured) */}
                  {!adminPassword && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-gray-500">
                        管理員密碼
                      </label>
                      <input
                        type="password"
                        placeholder="輸入密碼"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                      />
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="button"
                    onClick={submitPlay}
                    disabled={submitting}
                    className="w-full bg-gray-900 text-white px-4 py-3 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <svg
                          className="animate-spin h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        提交中...
                      </>
                    ) : (
                      "送出紀錄"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}