import type { BoardGameNewsData, BoardGameNewsEntry } from '@/lib/boardgamenews';

export interface PlayerCountSectionData {
  count: number;
  games: BoardGameNewsEntry[];
}

interface CloudGameRecord {
  name: string;
  year?: number;
  image?: string;
  minPlayers?: number;
  maxPlayers?: number;
  bestPlayers?: unknown;
  best_for?: unknown;
  best_players_summary?: number[];
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseNumberToken(token: string): number | null {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function expandRange(start: number, end: number): number[] {
  if (start > end) {
    return [];
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function parseBestPlayersValue(value: unknown): number[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? [value] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (typeof entry === 'number' && Number.isFinite(entry)) {
        return [entry];
      }

      if (typeof entry === 'string') {
        return parseBestPlayersValue(entry);
      }

      if (isRecord(entry)) {
        const directCount = entry.count ?? entry.playerCount ?? entry.value;
        if (typeof directCount === 'number' && Number.isFinite(directCount)) {
          return [directCount];
        }

        const nestedValues = Object.values(entry)
          .flatMap((nested) => parseBestPlayersValue(nested));
        return nestedValues;
      }

      return [];
    });
  }

  if (typeof value === 'string') {
    const tokens = value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

    return tokens.flatMap((token) => {
      const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/);
      if (rangeMatch) {
        const start = Number.parseInt(rangeMatch[1], 10);
        const end = Number.parseInt(rangeMatch[2], 10);
        return expandRange(start, end);
      }

      const parsed = parseNumberToken(token);
      return parsed === null ? [] : [parsed];
    });
  }

  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, nestedValue]) => {
      if (nestedValue === true) {
        return parseBestPlayersValue(key);
      }

      if (typeof nestedValue === 'number' && Number.isFinite(nestedValue)) {
        return [nestedValue];
      }

      return parseBestPlayersValue(nestedValue);
    });
  }

  return [];
}

function pickPreferredPlayerNumbers(game: CloudGameRecord): number[] {
  const candidates = [
    ...parseBestPlayersValue(game.best_players_summary),
    ...parseBestPlayersValue(game.best_for),
    ...parseBestPlayersValue(game.bestPlayers),
  ];

  return normalizePlayerCountCandidates(candidates);
}

function normalizePlayerCountCandidates(values: number[]): number[] {
  const uniqueValues = Array.from(new Set(values)).filter((value) => value >= 2 && value <= 6);
  return uniqueValues.sort((a, b) => a - b);
}

export function extractGamesFromPayload(payload: unknown): CloudGameRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord) as CloudGameRecord[];
  }

  if (!isRecord(payload)) {
    return [];
  }

  const objectEntries = Object.entries(payload);
  const playerCountBuckets = objectEntries.filter(([, value]) => Array.isArray(value));
  if (playerCountBuckets.length > 0) {
    return playerCountBuckets.flatMap(([, value]) => (value as unknown[]).filter(isRecord) as CloudGameRecord[]);
  }

  const objectValueGames = objectEntries
    .map(([, value]) => value)
    .filter(isRecord)
    .filter((value) => typeof value.name === 'string' || Array.isArray(value.best_for) || Array.isArray(value.best_players_summary));

  if (objectValueGames.length > 0) {
    return objectValueGames as CloudGameRecord[];
  }

  const candidateKeys = ['games', 'data', 'items', 'results', 'entries'];
  for (const key of candidateKeys) {
    const candidate = payload[key];
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord) as CloudGameRecord[];
    }
  }

  return Object.values(payload).filter(isRecord) as CloudGameRecord[];
}

export function normalizeCloudGamesToPlayerSections(
  games: CloudGameRecord[],
): PlayerCountSectionData[] {
  const sections = [2, 3, 4, 5, 6].map((count) => ({
    count,
    games: [] as BoardGameNewsEntry[],
  }));

  games.forEach((game) => {
    const playerNumbers = pickPreferredPlayerNumbers(game);

    playerNumbers.forEach((playerCount) => {
      const targetSection = sections.find((section) => section.count === playerCount);
      if (!targetSection) {
        return;
      }

      targetSection.games.push({
        bgg_id: String(game.name),
        name: game.name,
        year: game.year ?? 0,
        image: game.image ?? '',
        thumbnail: game.image ?? '',
        min_players: game.minPlayers ?? 0,
        max_players: game.maxPlayers ?? 0,
        play_time: 0,
        min_age: 0,
        weight: 0,
        rating: 0,
        users_rated: 0,
        bgg_rank: 0,
        categories: [],
        mechanics: [],
        designers: [],
        best_players_summary: game.best_players_summary ?? [],
        best_for: [playerCount],
      });
    });
  });

  return sections.filter((section) => section.games.length > 0);
}

export function normalizeCloudPayloadToSections(payload: unknown): PlayerCountSectionData[] {
  const games = extractGamesFromPayload(payload);
  const sections = normalizeCloudGamesToPlayerSections(games);

  const sectionMap = new Map(sections.map((section) => [section.count, section]));
  [2, 3, 4, 5, 6].forEach((count) => {
    if (!sectionMap.has(count)) {
      sectionMap.set(count, { count, games: [] });
    }
  });

  return [2, 3, 4, 5, 6].map((count) => sectionMap.get(count)!).filter(Boolean);
}

export function getVisiblePlayerCountSections(
  data: BoardGameNewsData,
  selectedCount: number | null,
): PlayerCountSectionData[] {
  const counts = [2, 3, 4, 5, 6] as const;

  return counts.map((count) => {
    const games = data[String(count)] ?? [];
    const visibleGames = selectedCount === null ? games : count === selectedCount ? games : [];

    return {
      count,
      games: visibleGames,
    };
  });
}
