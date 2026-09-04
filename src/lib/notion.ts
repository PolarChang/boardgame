import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { NotionGame, Player, PlayRecord, PlayLog, PlayLogPlayer } from "./types";
import { getCached, setCache, invalidateCache } from "./notion-cache";

let notionClient: Client | null = null;

export function getNotionClient(): Client {
  if (!notionClient) {
    const token = process.env.NOTION_TOKEN;
    if (!token) {
      throw new Error("NOTION_TOKEN environment variable is not set");
    }
    notionClient = new Client({ auth: token });
  }
  return notionClient;
}

function extractNumber(
  prop: PageObjectResponse["properties"][string] | undefined
): number {
  if (!prop || prop.type !== "number") return 0;
  const value = prop.number;
  return typeof value === "number" ? value : 0;
}

function extractTitle(
  prop: PageObjectResponse["properties"][string] | undefined
): string {
  if (!prop || prop.type !== "title") return "";
  return prop.title.map((t) => t.plain_text).join("");
}

function extractRichText(
  prop: PageObjectResponse["properties"][string] | undefined
): string {
  if (!prop || prop.type !== "rich_text") return "";
  return prop.rich_text.map((t) => t.plain_text).join("");
}

function extractSelect(
  prop: PageObjectResponse["properties"][string] | undefined
): string | null {
  if (!prop || prop.type !== "select") return null;
  return prop.select?.name ?? null;
}

function extractTitleOrRichText(
  prop: PageObjectResponse["properties"][string] | undefined
): string {
  if (!prop) return "";
  if (prop.type === "title") return prop.title.map((t) => t.plain_text).join("");
  if (prop.type === "rich_text")
    return prop.rich_text.map((t) => t.plain_text).join("");
  return "";
}

function extractUrl(
  prop: PageObjectResponse["properties"][string] | undefined
): string {
  if (!prop || prop.type !== "url") return "";
  return prop.url ?? "";
}

function extractCoverImageUrl(
  prop: PageObjectResponse["properties"][string] | undefined
): string {
  if (!prop || prop.type !== "files") return "";

  const file = prop.files[0];
  if (!file) return "";

  if (file.type === "external") {
    return file.external.url;
  }

  if (file.type === "file") {
    return file.file.url;
  }

  return "";
}

function extractDateStart(
  prop: PageObjectResponse["properties"][string] | undefined
): string {
  if (!prop || prop.type !== "date") return "";
  return prop.date?.start ?? "";
}

function extractRelationIds(
  prop: PageObjectResponse["properties"][string] | undefined
): string[] {
  if (!prop || prop.type !== "relation") return [];
  return prop.relation.map((r) => r.id).filter(Boolean);
}

function extractMultiSelect(
  prop: PageObjectResponse["properties"][string] | undefined
): string[] {
  if (!prop || prop.type !== "multi_select") return [];
  return prop.multi_select.map((item) => item.name).filter(Boolean);
}

function extractCheckbox(
  prop: PageObjectResponse["properties"][string] | undefined
): boolean {
  if (!prop || prop.type !== "checkbox") return false;
  return prop.checkbox ?? false;
}

function extractPageTitle(page: PageObjectResponse): string {
  const titleProp = Object.values(page.properties).find((p) => p.type === "title");
  if (!titleProp || titleProp.type !== "title") return "";
  return titleProp.title.map((t) => t.plain_text).join("");
}

function parseNotionPage(page: PageObjectResponse): NotionGame | null {
  const props = page.properties;

  const bggId = extractNumber(props["BGG ID"]);
  const name = extractTitle(props["Game Title"]);
  const chineseName = extractTitleOrRichText(props["Chinese Name"]);
  const designer = extractTitleOrRichText(props.Designer ?? props["Designer"]);
  const publisher = extractTitleOrRichText(props.Publisher ?? props["Publisher"]);
  const comment = extractTitleOrRichText(props.Comment ?? props["Comment"]);

  const rawType = extractSelect(props["Type"]);
  const type =
    rawType === "Expansion" ? "Expansion" : "Base";

  const rawOwnership = extractSelect(props["Ownership"]);
  const ownership =
    rawOwnership === "Played Elsewhere" ? "Played Elsewhere" : "Owned";

  if (!bggId || !name) {
    return null;
  }

  return {
    pageId: page.id,
    bggId,
    name,
    chineseName,
    designer,
    publisher,
    comment,
    type,
    ownership,
    image: extractCoverImageUrl(props["Cover Image"]),
    minPlayers: extractNumber(props["Min Players"]),
    maxPlayers: extractNumber(props["Max Players"]),
    bestPlayers: extractRichText(props["Best Player Count"]),
    playTime: extractNumber(props.Playtime),
    complexity: extractNumber(props.Complexity),
    rating: extractNumber(props["BGG Rating"]),
    playCount: extractNumber(props["Play Count"]),
    bggLink: extractUrl(props["BGG Link"]),
    scoreFields: extractMultiSelect(props["Score Fields"]),
    victoryConditions: extractMultiSelect(props["Victory Conditions"]),
  };
}

export async function getGamesFromNotion(bypassCache = false): Promise<NotionGame[]> {
  const databaseId = process.env.NOTION_DATABASE_ID;
  if (!databaseId) {
    throw new Error("NOTION_DATABASE_ID environment variable is not set");
  }

  // Force cache refresh if requested
  if (bypassCache) {
    invalidateCache("notion:main_games");
  }

  // Use cached version with page_size=100 for speed
  const pages = await queryAllPagesCached(databaseId, undefined, "notion:main_games");

  const games: NotionGame[] = [];

  for (const page of pages) {
    const game = parseNotionPage(page);
    if (game) {
      games.push(game);
    }
  }

  return games.sort((a, b) => a.name.localeCompare(b.name));
}

async function queryAllPages(databaseId: string, params?: Record<string, unknown>) {
  const notion = getNotionClient();
  const results: PageObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      ...(params ?? {}),
    });

    for (const page of response.results) {
      if (page.object !== "page" || !("properties" in page)) continue;
      results.push(page as PageObjectResponse);
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return results;
}

const PLAYERS_NAME_PROP = "Name";
const PLAYS_DATE_PROP = "Date";
const PLAYS_GAME_PROP = "Game";
const PLAYS_PLAYERS_PROP = "Players";
const PLAYS_SCORES_PROP = "Scores";
const PLAYS_LOCATION_PROP = "Location";
const PLAYS_NOTES_PROP = "Notes";
const PLAYS_PLAY_ID_PROP = "Play ID";

const PLAYER_SCORES_RECORD_ID_PROP = "Record ID";
const PLAYER_SCORES_PLAY_PROP = "Plays (遊玩場次)";
const PLAYER_SCORES_PLAYER_PROP = "Player";
const PLAYER_SCORES_SCORE_PROP = "Score";
const PLAYER_SCORES_IS_WINNER_PROP = "Is Winner";
const PLAYER_SCORES_FIRST_PLAY_PROP = "First Play";

export async function getPlayers(): Promise<Player[]> {
  const databaseId = process.env.NOTION_PLAYERS_DB_ID;
  if (!databaseId) {
    throw new Error("NOTION_PLAYERS_DB_ID environment variable is not set");
  }

  const pages = await queryAllPages(databaseId);
  return pages
    .map((p) => ({ id: p.id, name: extractPageTitle(p) }))
    .filter((p) => Boolean(p.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createPlayer(name: string): Promise<Player> {
  const databaseId = process.env.NOTION_PLAYERS_DB_ID;
  if (!databaseId) {
    throw new Error("NOTION_PLAYERS_DB_ID environment variable is not set");
  }

  const notion = getNotionClient();
  const page = await notion.pages.create({
    parent: { database_id: databaseId },
    properties: {
      [PLAYERS_NAME_PROP]: {
        title: [{ text: { content: name } }],
      },
    },
  });

  if (page.object !== "page") {
    throw new Error("Failed to create player");
  }

  return { id: page.id, name };
}

/** Delete a player by page ID */
export async function deletePlayer(playerId: string): Promise<void> {
  const notion = getNotionClient();
  await notion.pages.update({
    page_id: playerId,
    archived: true,
  });
}

/**
 * Create a play session page in the Plays database.
 */
export async function createPlaySession(data: {
  gameId: string;
  date: string;
  location: string;
  notes?: string;
}): Promise<{ id: string }> {
  const databaseId = process.env.NOTION_PLAYS_DB_ID;
  if (!databaseId) throw new Error("NOTION_PLAYS_DB_ID is not set");

  const notion = getNotionClient();

  const autoPlayId = `play_${data.date}_${data.gameId.slice(0, 8)}`;
  const props: Record<string, unknown> = {
    [PLAYS_PLAY_ID_PROP]: {
      title: [{ text: { content: autoPlayId } }],
    },
    [PLAYS_DATE_PROP]: { date: { start: data.date } },
    [PLAYS_GAME_PROP]: { relation: [{ id: data.gameId }] },
  } as Record<string, unknown>;

  if (data.location) {
    props[PLAYS_LOCATION_PROP] = { select: { name: data.location } };
  }
  if (data.notes) {
    props[PLAYS_NOTES_PROP] = {
      rich_text: [{ text: { content: data.notes } }],
    };
  }

  const page = await notion.pages.create({
    parent: { database_id: databaseId },
    properties: props as any,
  });

  if (page.object !== "page") {
    throw new Error("Failed to create play session");
  }

  return { id: page.id };
}

/**
 * Create a player score page in the Player Scores database.
 */
export async function createPlayerScore(data: {
  playId: string;
  playerId: string;
  score: number;
  isWinner: boolean;
  firstPlay: boolean;
}): Promise<{ id: string }> {
  const databaseId = process.env.NOTION_PLAYER_SCORES_DB_ID;
  if (!databaseId) throw new Error("NOTION_PLAYER_SCORES_DB_ID is not set");

  const notion = getNotionClient();

  const page = await notion.pages.create({
    parent: { database_id: databaseId },
    properties: {
      [PLAYER_SCORES_RECORD_ID_PROP]: {
        title: [{ text: { content: `score_${Date.now()}` } }],
      },
      [PLAYER_SCORES_PLAY_PROP]: {
        relation: [{ id: data.playId }],
      },
      [PLAYER_SCORES_PLAYER_PROP]: {
        relation: [{ id: data.playerId }],
      },
      [PLAYER_SCORES_SCORE_PROP]: {
        number: data.score,
      },
      [PLAYER_SCORES_IS_WINNER_PROP]: {
        checkbox: data.isWinner,
      },
      [PLAYER_SCORES_FIRST_PLAY_PROP]: {
        checkbox: data.firstPlay,
      },
    },
  });

  if (page.object !== "page") {
    throw new Error("Failed to create player score");
  }

  return { id: page.id };
}

/**
 * Delete a play session and all related player scores.
 */
export async function deletePlaySession(playId: string): Promise<void> {
  const notion = getNotionClient();
  const playerScoresDbId = process.env.NOTION_PLAYER_SCORES_DB_ID;

  // Delete related player scores first
  if (playerScoresDbId) {
    const scores = await notion.databases.query({
      database_id: playerScoresDbId,
      filter: {
        property: PLAYER_SCORES_PLAY_PROP,
        relation: { contains: playId },
      },
    });

    for (const page of scores.results) {
      const scorePage = page as PageObjectResponse;
      try {
        await notion.pages.update({
          page_id: scorePage.id,
          archived: true,
        });
      } catch {
        // Silently continue
      }
    }
  }

  // Archive the play session
  try {
    await notion.pages.update({
      page_id: playId,
      archived: true,
    });
  } catch {
    // Silently continue
  }
}

/**
 * Query all pages from a Notion database, with caching support.
 * Uses maximum page_size (100) to reduce round-trips.
 */
async function queryAllPagesCached(
  databaseId: string,
  params?: Record<string, unknown>,
  cacheKey?: string
): Promise<PageObjectResponse[]> {
  // Check cache first
  if (cacheKey) {
    const cached = getCached<PageObjectResponse[]>(cacheKey);
    if (cached) return cached;
  }

  const notion = getNotionClient();
  const results: PageObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100, // Max per page — fewer round trips
      ...(params ?? {}),
    });

    for (const page of response.results) {
      if (page.object !== "page" || !("properties" in page)) continue;
      results.push(page as PageObjectResponse);
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  // Store in cache
  if (cacheKey) {
    setCache(cacheKey, results);
  }

  return results;
}

const CACHE_KEY_PLAYS = "notion:plays";
const CACHE_KEY_SCORES = "notion:scores";
const CACHE_KEY_PLAYERS = "notion:players";
const CACHE_KEY_GAMES = "notion:games";
const CACHE_KEY_MAIN_GAMES = "notion:main_games";

/**
 * Invalidate dashboard-related caches (after create/delete).
 */
export function invalidateDashboardCache(): void {
  invalidateCache("notion:plays");
  invalidateCache("notion:scores");
  invalidateCache("notion:players");
  invalidateCache("notion:games");
}

/**
 * Get all play logs (detailed view with player scores, player names, game names).
 * Optimized with:
 *  - Parallel fetching of all 4 databases
 *  - In-memory caching (default 30s TTL)
 *  - Max page_size (100) for fewer API round-trips
 */
export async function getDetailedPlayLogs(): Promise<PlayLog[]> {
  const playsDbId = process.env.NOTION_PLAYS_DB_ID;
  const playerScoresDbId = process.env.NOTION_PLAYER_SCORES_DB_ID;
  const playersDbId = process.env.NOTION_PLAYERS_DB_ID;
  const gamesDbId = process.env.NOTION_DATABASE_ID;

  if (!playsDbId) throw new Error("NOTION_PLAYS_DB_ID is not set");
  if (!playersDbId) throw new Error("NOTION_PLAYERS_DB_ID is not set");

  // Fetch databases in PARALLEL (with caching) — Player Scores is optional
  const fetchPlays = queryAllPagesCached(playsDbId, undefined, CACHE_KEY_PLAYS);
  const fetchScores = playerScoresDbId
    ? queryAllPagesCached(playerScoresDbId, undefined, CACHE_KEY_SCORES)
    : Promise.resolve([] as PageObjectResponse[]);
  const fetchPlayers = queryAllPagesCached(playersDbId, undefined, CACHE_KEY_PLAYERS);
  const fetchGames = gamesDbId
    ? queryAllPagesCached(gamesDbId, undefined, CACHE_KEY_GAMES)
    : Promise.resolve([] as PageObjectResponse[]);

  const [playPages, scorePages, playerPages, gamePages] = await Promise.all([
    fetchPlays,
    fetchScores,
    fetchPlayers,
    fetchGames,
  ]);

  if (playPages.length === 0) return [];

  // Build lookup maps (O(n) — fast)
  const playerNameMap = new Map<string, string>();
  for (const p of playerPages) {
    playerNameMap.set(p.id, extractPageTitle(p));
  }

  const gameNameMap = new Map<string, string>();
  for (const g of gamePages) {
    const props = g.properties;
    const name = extractTitle(props["Game Title"]);
    const chineseName = extractTitleOrRichText(props["Chinese Name"]);
    gameNameMap.set(g.id, (chineseName || name));
  }

  // Build scores lookup by playId
  const scoresByPlayId = new Map<string, PageObjectResponse[]>();
  for (const sp of scorePages) {
    const props = sp.properties;
    const playRelations = extractRelationIds(props[PLAYER_SCORES_PLAY_PROP]);
    for (const playId of playRelations) {
      const existing = scoresByPlayId.get(playId) || [];
      existing.push(sp);
      scoresByPlayId.set(playId, existing);
    }
  }

  // Build PlayLog array
  const logs: PlayLog[] = [];

  for (const playPage of playPages) {
    const props = playPage.properties;
    const playId = playPage.id;
    const date = extractDateStart(props[PLAYS_DATE_PROP]);
    const gameIds = extractRelationIds(props[PLAYS_GAME_PROP]);
    const gameId = gameIds[0] || "";
    const gameName = gameNameMap.get(gameId) || "Unknown Game";
    const location = extractSelect(props[PLAYS_LOCATION_PROP]);
    const notes = extractRichText(props[PLAYS_NOTES_PROP]);

    const relatedScores = scoresByPlayId.get(playId) || [];

    const players: PlayLogPlayer[] = [];
    if (relatedScores.length > 0) {
      // Build players from Player Scores database (detailed scores)
      for (const sp of relatedScores) {
        const spProps = sp.properties;
        const pIds = extractRelationIds(spProps[PLAYER_SCORES_PLAYER_PROP]);
        const playerId = pIds[0] || "";
        const score = extractNumber(spProps[PLAYER_SCORES_SCORE_PROP]);
        const isWinner = extractCheckbox(spProps[PLAYER_SCORES_IS_WINNER_PROP]);
        const playerName = playerNameMap.get(playerId) || "Unknown";

        players.push({
          name: playerName,
          score,
          isWinner,
          factionOrColor: undefined,
        });
      }
    } else {
      // Fallback: extract player names from the "Players" relation property
      const playerIds = extractRelationIds(props[PLAYS_PLAYERS_PROP]);
      for (const playerId of playerIds) {
        const playerName = playerNameMap.get(playerId) || "Unknown";
        players.push({
          name: playerName,
          score: 0,
          isWinner: false,
          factionOrColor: undefined,
        });
      }
    }

    logs.push({
      id: playId,
      gameId,
      gameName,
      date,
      location: location ?? undefined,
      durationMinutes: 0,
      players,
      endgamePhotoUrl: undefined,
      notes: notes || undefined,
    });
  }

  return logs.sort((a, b) => b.date.localeCompare(a.date));
}

/** Alias to invalidate dashboard cache from API route */
export { invalidateDashboardCache as clearDashboardCache };

export async function getGamePlays(gameId?: string): Promise<PlayRecord[]> {
  const databaseId = process.env.NOTION_PLAYS_DB_ID;
  if (!databaseId) {
    throw new Error("NOTION_PLAYS_DB_ID environment variable is not set");
  }

  const filter = gameId
    ? {
        property: PLAYS_GAME_PROP,
        relation: { contains: gameId },
      }
    : undefined;

  const pages = await queryAllPages(databaseId, filter ? { filter } : undefined);

  const notion = getNotionClient();
  const playerCache = new Map<string, Promise<Player>>();

  const getPlayerById = (id: string) => {
    const cached = playerCache.get(id);
    if (cached) return cached;
    const p = (async (): Promise<Player> => {
      const res = await notion.pages.retrieve({ page_id: id });
      if (res.object !== "page" || !("properties" in res)) {
        return { id, name: "" };
      }
      const page = res as PageObjectResponse;
      return { id: page.id, name: extractPageTitle(page) };
    })();
    playerCache.set(id, p);
    return p;
  };

  const records = await Promise.all(
    pages.map(async (page): Promise<PlayRecord> => {
      const props = page.properties;

      const date = extractDateStart(props[PLAYS_DATE_PROP]);
      const gameIds = extractRelationIds(props[PLAYS_GAME_PROP]);

      // Get player scores for this play
      const playerScoresDbId = process.env.NOTION_PLAYER_SCORES_DB_ID;
      const scorePages = playerScoresDbId
        ? await notion.databases.query({
            database_id: playerScoresDbId,
            filter: {
              property: PLAYER_SCORES_PLAY_PROP,
              relation: { contains: page.id },
            },
          })
        : { results: [] };

      const playerIds: string[] = [];
      const rawScores: { playerId: string; score: number; isWinner: boolean }[] = [];

      for (const sp of scorePages.results) {
        if (!("properties" in sp)) continue;
        const spProps = (sp as PageObjectResponse).properties;
        const pIds = extractRelationIds(spProps[PLAYER_SCORES_PLAYER_PROP]);
        const score = extractNumber(spProps[PLAYER_SCORES_SCORE_PROP]);
        const isWinner = extractCheckbox(spProps[PLAYER_SCORES_IS_WINNER_PROP]);

        for (const pid of pIds) {
          if (!playerIds.includes(pid)) playerIds.push(pid);
          rawScores.push({ playerId: pid, score, isWinner });
        }
      }

      const players = (await Promise.all(playerIds.map(getPlayerById))).filter(
        (p) => Boolean(p.name)
      );

      const playerNameMap = new Map(players.map((p) => [p.id, p.name]));

      // Build score text using resolved player names, not raw page IDs
      const scoreTexts = rawScores.map(
        ({ playerId, score, isWinner }) =>
          `${playerNameMap.get(playerId) || "未知"}: ${score}${isWinner ? " 👑" : ""}`
      );
      const scores = scoreTexts.join(", ") || extractRichText(props[PLAYS_SCORES_PROP]);

      return {
        id: page.id,
        date,
        gameId: gameIds[0] ?? "",
        players,
        scores,
      };
    })
  );

  return records.sort((a, b) => b.date.localeCompare(a.date));
}

export async function createPlayRecord(data: {
  gameId: string;
  date: string;
  playerIds: string[];
  scores: string;
}): Promise<PlayRecord> {
  const databaseId = process.env.NOTION_PLAYS_DB_ID;
  if (!databaseId) {
    throw new Error("NOTION_PLAYS_DB_ID environment variable is not set");
  }

  const notion = getNotionClient();

  const page = await notion.pages.create({
    parent: { database_id: databaseId },
    properties: {
      [PLAYS_DATE_PROP]: { date: { start: data.date } },
      [PLAYS_GAME_PROP]: { relation: [{ id: data.gameId }] },
      [PLAYS_PLAYERS_PROP]: {
        relation: data.playerIds.map((id) => ({ id })),
      },
      [PLAYS_SCORES_PROP]: {
        rich_text: [{ text: { content: data.scores } }],
      },
    },
  });

  if (page.object !== "page") {
    throw new Error("Failed to create play record");
  }

  const players = await Promise.all(
    data.playerIds.map(async (id) => {
      const res = await notion.pages.retrieve({ page_id: id });
      if (res.object !== "page" || !("properties" in res)) {
        return { id, name: "" };
      }
      const p = res as PageObjectResponse;
      return { id: p.id, name: extractPageTitle(p) };
    })
  );

  return {
    id: page.id,
    date: data.date,
    gameId: data.gameId,
    players: players.filter((p) => Boolean(p.name)),
    scores: data.scores,
  };
}
