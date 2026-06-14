"use client";

import type { SavedPlayer } from "@/lib/types";

const STORAGE_KEY = "boardgame_players";

function generateId(): string {
  return `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/** Get all saved players from localStorage */
export function getPlayers(): SavedPlayer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedPlayer[];
  } catch {
    return [];
  }
}

/** Save a new player. If a player with the same name exists, return existing. */
export function savePlayer(name: string): SavedPlayer {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Player name cannot be empty");

  const players = getPlayers();

  // Check for existing player with same name (case-insensitive)
  const existing = players.find(
    (p) => p.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (existing) return existing;

  const newPlayer: SavedPlayer = {
    id: generateId(),
    name: trimmed,
  };

  players.push(newPlayer);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
  return newPlayer;
}

/** Delete a player by ID */
export function deletePlayer(id: string): void {
  const players = getPlayers();
  const filtered = players.filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/** Ensure a list of player names all exist in storage, return the full SavedPlayer list */
export function ensurePlayersExist(names: string[]): SavedPlayer[] {
  names.forEach((name) => {
    if (name.trim()) savePlayer(name);
  });
  return getPlayers();
}