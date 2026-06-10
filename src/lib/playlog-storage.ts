"use client";

import type { PlayLog, PlayLogPlayer } from "@/lib/types";

const STORAGE_KEY = "boardgame_playlogs";

// Generate a unique ID
function generateId(): string {
  return `play_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Get all play logs from localStorage
export function getPlayLogs(): PlayLog[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PlayLog[];
  } catch {
    return [];
  }
}

// Save a new play log
export function savePlayLog(log: Omit<PlayLog, "id">): PlayLog {
  const newLog: PlayLog = {
    ...log,
    id: generateId(),
  };
  const existing = getPlayLogs();
  existing.push(newLog);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  return newLog;
}

// Delete a play log by ID
export function deletePlayLog(id: string): void {
  const existing = getPlayLogs();
  const filtered = existing.filter((log) => log.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

// Get play logs for a specific game
export function getPlayLogsByGame(gameId: string): PlayLog[] {
  return getPlayLogs().filter((log) => log.gameId === gameId);
}

// Initialize with mock data (for testing)
export function seedMockPlayLogs(): void {
  const existing = getPlayLogs();
  if (existing.length > 0) return; // Don't overwrite existing data

  const mockLogs: PlayLog[] = [
    {
      id: "mock_1",
      gameId: "mock_lisboa",
      gameName: "Lisboa",
      date: "2026-05-15",
      location: "桌遊地下城",
      durationMinutes: 240,
      players: [
        { name: "小智", score: 145, isWinner: true, factionOrColor: "藍色貴族" },
        { name: "小霞", score: 128, isWinner: false, factionOrColor: "紅色商人" },
        { name: "小剛", score: 112, isWinner: false, factionOrColor: "綠色教會" },
      ],
      notes: "小智靠著大地震後的房地產低買高賣，大獲全勝！",
    },
    {
      id: "mock_2",
      gameId: "mock_foodchain",
      gameName: "Food Chain Magnate",
      date: "2026-05-10",
      location: "小豪家",
      durationMinutes: 210,
      players: [
        { name: "小豪", score: 320, isWinner: true, factionOrColor: "速食王國" },
        { name: "小智", score: 285, isWinner: false, factionOrColor: "海鮮餐廳" },
        { name: "小霞", score: 245, isWinner: false, factionOrColor: "飲料帝國" },
        { name: "小剛", score: 190, isWinner: false, factionOrColor: "烘焙坊" },
      ],
      notes: "小豪利用總部行銷總監打了三輪廣告，直接海撈一筆。",
    },
    {
      id: "mock_3",
      gameId: "mock_greatzimbabwe",
      gameName: "The Great Zimbabwe",
      date: "2026-05-08",
      location: "桌遊地下城",
      durationMinutes: 150,
      players: [
        { name: "小霞", score: 28, isWinner: true, factionOrColor: "工匠" },
        { name: "小智", score: 24, isWinner: false, factionOrColor: "祭司" },
      ],
      notes: "雙人簡短局，小霞神廟蓋好蓋滿。",
    },
    {
      id: "mock_4",
      gameId: "mock_onmars",
      gameName: "On Mars",
      date: "2026-04-28",
      location: "小智家",
      durationMinutes: 270,
      players: [
        { name: "小智", score: 182, isWinner: true, factionOrColor: "藍色宇航局" },
        { name: "小豪", score: 176, isWinner: false, factionOrColor: "紅色私人企業" },
      ],
      notes: "史上最糾結的火星殖民之戰！僅差6分。",
    },
    {
      id: "mock_5",
      gameId: "mock_wingspan",
      gameName: "Wingspan",
      date: "2026-04-20",
      location: "咖啡廳",
      durationMinutes: 60,
      players: [
        { name: "小剛", score: 89, isWinner: true, factionOrColor: "森林鳥" },
        { name: "小霞", score: 74, isWinner: false, factionOrColor: "草原鳥" },
        { name: "小智", score: 82, isWinner: false, factionOrColor: "溼地鳥" },
      ],
      notes: "小剛用森林鳥類引擎，每回合穩定產蛋與抽牌。",
    },
  ];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(mockLogs));
}