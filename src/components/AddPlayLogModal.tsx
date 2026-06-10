"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { PlayLogPlayer } from "@/lib/types";
import { savePlayLog, getPlayLogs } from "@/lib/playlog-storage";

interface AddPlayLogModalProps {
  onClose: () => void;
  onSaved: () => void;
}

interface PlayerFormEntry {
  name: string;
  score: number;
  factionOrColor: string;
  isWinner: boolean;
}

function emptyPlayer(): PlayerFormEntry {
  return { name: "", score: 0, factionOrColor: "", isWinner: false };
}

function todayISO(): string {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

// Known game list (can be expanded)
const KNOWN_GAMES = [
  "Lisboa",
  "Food Chain Magnate",
  "The Great Zimbabwe",
  "On Mars",
  "Wingspan",
  " Brass: Birmingham",
  "Gaia Project",
  "Terraforming Mars",
  "Gloomhaven",
  "Pandemic Legacy",
];

export default function AddPlayLogModal({
  onClose,
  onSaved,
}: AddPlayLogModalProps) {
  const [gameName, setGameName] = useState("");
  const [date, setDate] = useState(todayISO);
  const [location, setLocation] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [notes, setNotes] = useState("");
  const [players, setPlayers] = useState<PlayerFormEntry[]>([
    emptyPlayer(),
    emptyPlayer(),
  ]);
  const [endgamePhotoBase64, setEndgamePhotoBase64] = useState<string | null>(
    null
  );
  const [gameSuggestion, setGameSuggestion] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Game name autocomplete
  const handleGameNameChange = (value: string) => {
    setGameName(value);
    if (value.length > 0) {
      const filtered = KNOWN_GAMES.filter((g) =>
        g.toLowerCase().includes(value.toLowerCase())
      );
      setGameSuggestion(filtered);
    } else {
      setGameSuggestion([]);
    }
  };

  const selectGame = (name: string) => {
    setGameName(name);
    setGameSuggestion([]);
  };

  // Players handlers
  const addPlayer = () => {
    setPlayers((prev) => [...prev, emptyPlayer()]);
  };

  const removePlayer = (idx: number) => {
    if (players.length <= 1) return;
    setPlayers((prev) => prev.filter((_, i) => i !== idx));
  };

  const updatePlayer = (idx: number, updates: Partial<PlayerFormEntry>) => {
    setPlayers((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...updates } : p))
    );
  };

  // Image upload handler (base64 via FileReader)
  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        window.alert("圖片檔案過大，請選擇小於 5MB 的圖片。");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setEndgamePhotoBase64(result);
      };
      reader.readAsDataURL(file);
    },
    []
  );

  const removePhoto = () => {
    setEndgamePhotoBase64(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Submit handler
  const handleSubmit = () => {
    if (!gameName.trim()) {
      window.alert("請輸入遊戲名稱。");
      return;
    }
    const validPlayers = players.filter((p) => p.name.trim().length > 0);
    if (validPlayers.length === 0) {
      window.alert("請至少輸入一位玩家名稱。");
      return;
    }

    const playLogPlayers: PlayLogPlayer[] = validPlayers.map((p) => ({
      name: p.name.trim(),
      score: p.score,
      factionOrColor: p.factionOrColor.trim() || undefined,
      isWinner: p.isWinner,
    }));

    const newLog = savePlayLog({
      gameId: gameName.trim().toLowerCase().replace(/\s+/g, "_"),
      gameName: gameName.trim(),
      date,
      location: location.trim() || undefined,
      durationMinutes,
      players: playLogPlayers,
      endgamePhotoUrl: endgamePhotoBase64 || undefined,
      notes: notes.trim() || undefined,
    });

    if (newLog) {
      onSaved();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative max-w-2xl w-[95vw] max-h-[90vh] flex flex-col bg-parchment-light shadow-euro-lg overflow-hidden brass-border-thin">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-grid-line px-6 py-4 shrink-0 bg-parchment">
          <h2 className="font-heading text-lg font-bold tracking-wider text-ink">
            ✚ 新增遊玩紀錄
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-ink-muted hover:bg-parchment-dark hover:text-ink transition-colors"
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

        {/* Scrollable Form Body */}
        <div className="overflow-auto flex-grow p-6">
          <div className="space-y-6">
            {/* Game Name with Autocomplete */}
            <div className="relative">
              <label className="mb-1.5 block font-heading text-xs font-semibold uppercase tracking-wider text-ink-light">
                遊戲名稱 <span className="text-wax-red">*</span>
              </label>
              <input
                type="text"
                value={gameName}
                onChange={(e) => handleGameNameChange(e.target.value)}
                placeholder="輸入或選擇遊戲..."
                className="input-euro w-full rounded-lg"
              />
              {gameSuggestion.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-parchment border border-grid-line rounded-lg shadow-euro max-h-40 overflow-y-auto">
                  {gameSuggestion.map((name) => (
                    <li
                      key={name}
                      onClick={() => selectGame(name)}
                      className="px-3 py-2 text-sm text-ink hover:bg-brass/10 cursor-pointer transition-colors"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Date & Location Row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block font-heading text-xs font-semibold uppercase tracking-wider text-ink-light">
                  日期
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input-euro w-full rounded-lg"
                />
              </div>
              <div>
                <label className="mb-1.5 block font-heading text-xs font-semibold uppercase tracking-wider text-ink-light">
                  地點
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="桌遊店、家裡..."
                  className="input-euro w-full rounded-lg"
                />
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="mb-1.5 block font-heading text-xs font-semibold uppercase tracking-wider text-ink-light">
                遊戲時長（分鐘）
              </label>
              <input
                type="number"
                min={1}
                value={durationMinutes}
                onChange={(e) =>
                  setDurationMinutes(Math.max(1, parseInt(e.target.value) || 60))
                }
                className="input-euro w-full rounded-lg"
              />
            </div>

            {/* Players Section */}
            <div className="space-y-3">
              <label className="mb-1.5 block font-heading text-xs font-semibold uppercase tracking-wider text-ink-light">
                參與玩家 <span className="text-wax-red">*</span>
              </label>
              {players.map((player, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center gap-2 bg-parchment border border-grid-line rounded-lg p-3"
                >
                  <input
                    type="text"
                    value={player.name}
                    onChange={(e) =>
                      updatePlayer(idx, { name: e.target.value })
                    }
                    placeholder="玩家名稱"
                    className="input-euro rounded flex-1 min-w-[100px] text-sm"
                  />
                  <input
                    type="number"
                    value={player.score}
                    onChange={(e) =>
                      updatePlayer(idx, {
                        score: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="分數"
                    className="input-euro rounded w-20 text-sm"
                  />
                  <input
                    type="text"
                    value={player.factionOrColor}
                    onChange={(e) =>
                      updatePlayer(idx, {
                        factionOrColor: e.target.value,
                      })
                    }
                    placeholder="陣營/顏色"
                    className="input-euro rounded w-24 text-sm"
                  />
                  <label className="flex items-center gap-1 text-xs text-ink-light cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={player.isWinner}
                      onChange={(e) =>
                        updatePlayer(idx, { isWinner: e.target.checked })
                      }
                      className="accent-euro-blue h-4 w-4"
                    />
                    嬴家
                  </label>
                  {players.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePlayer(idx)}
                      className="text-ink-muted hover:text-wax-red transition-colors p-1"
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
              <button
                type="button"
                onClick={addPlayer}
                className="flex items-center justify-center gap-1.5 w-full border border-dashed border-grid-line rounded-lg px-3 py-2 text-sm text-ink-muted hover:text-ink hover:border-brass transition-colors"
              >
                + 新增玩家
              </button>
            </div>

            {/* Image Upload */}
            <div>
              <label className="mb-1.5 block font-heading text-xs font-semibold uppercase tracking-wider text-ink-light">
                終局盤面照
              </label>
              <div className="flex items-center gap-4 flex-wrap">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-euro rounded-lg text-sm"
                >
                  📷 選擇圖片
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                {endgamePhotoBase64 && (
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="text-xs text-wax-red hover:text-wax-red-dark transition-colors"
                  >
                    移除照片
                  </button>
                )}
              </div>
              {endgamePhotoBase64 && (
                <div className="mt-3 vintage-frame inline-block">
                  <div className="relative w-48 h-36">
                    <Image
                      src={endgamePhotoBase64}
                      alt="終局盤面預覽"
                      fill
                      className="object-contain"
                      sizes="200px"
                    />
                  </div>
                </div>
              )}
              {!endgamePhotoBase64 && (
                <p className="mt-1 text-xs text-ink-muted">
                  支援 JPG / PNG，最多 5MB。圖片將以 Base64 儲存於本機。
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1.5 block font-heading text-xs font-semibold uppercase tracking-wider text-ink-light">
                戰局短評
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="例如：小剛靠著黑市內線交易翻盤..."
                rows={3}
                className="input-euro w-full rounded-lg resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-grid-line px-6 py-4 shrink-0 bg-parchment">
          <button
            type="button"
            onClick={onClose}
            className="btn-euro rounded-lg text-sm"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="btn-wax-seal rounded-lg text-sm"
          >
            ✚ 儲存紀錄
          </button>
        </div>
      </div>
    </div>
  );
}