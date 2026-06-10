import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { NotionGame, Player, PlayRecord, PlayLog, PlayLogPlayer } from "./types";

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
  };
}

export async function getGamesFromNotion(): Promise<NotionGame[]> {
  const databaseId = process.env.NOTION_DATABASE_ID;
  if (!databaseId) {
    throw new Error("NOTION_DATABASE_ID environment variable is not set");
  }

  const notion = getNotionClient();
  const games: NotionGame[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
    });

    for (const page of response.results) {
      if (page.object !== "page" || !("properties" in page)) continue;

      const game = parseNotionPage(page);
      if (game) {
        games.push(game);
      }
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

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
 * Get all play logs (detailed view with player scores, player names, game names).
 * Returns PlayLog[] for the Dashboard.
 */
export async function getDetailedPlayLogs(): Promise<PlayLog[]> {
  const playsDbId = process.env.NOTION_PLAYS_DB_ID;
  const playerScoresDbId = process.env.NOTION_PLAYER_SCORES_DB_ID;
  const playersDbId = process.env.NOTION_PLAYERS_DB_ID;
  const gamesDbId = process.env.NOTION_DATABASE_ID;

  if (!playsDbId) throw new Error("NOTION_PLAYS_DB_ID is not set");
  if (!playerScoresDbId) throw new Error("NOTION_PLAYER_SCORES_DB_ID is not set");
  if (!playersDbId) throw new Error("NOTION_PLAYERS_DB_ID is not set");

  const notion = getNotionClient();

  // 1. Fetch all plays
  const playPages = await queryAllPages(playsDbId);
  if (playPages.length === 0) return [];

  // 2. Fetch all player scores
  const scorePages = await queryAllPages(playerScoresDbId);

  // 3. Fetch all players (name lookup)
  const playerPages = await queryAllPages(playersDbId);
  const playerNameMap = new Map<string, string>();
  for (const p of playerPages) {
    playerNameMap.set(p.id, extractPageTitle(p));
  }

  // 4. Fetch all games (name lookup)
  let gameNameMap = new Map<string, string>();
  if (gamesDbId) {
    const gamePages = await queryAllPages(gamesDbId);
    for (const g of gamePages) {
      const props = g.properties;
      const name = extractTitle(props["Game Title"]);
      const chineseName = extractTitleOrRichText(props["Chinese Name"]);
      gameNameMap.set(g.id, (chineseName || name));
    }
  }

  // 5. Build scores lookup by playId
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

  // 6. Build PlayLog array
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

    // Get scores for this play
    const relatedScores = scoresByPlayId.get(playId) || [];

    const players: PlayLogPlayer[] = [];
    for (const sp of relatedScores) {
      const spProps = sp.properties;
      const playerIds = extractRelationIds(spProps[PLAYER_SCORES_PLAYER_PROP]);
      const playerId = playerIds[0] || "";
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

    logs.push({
      id: playId,
      gameId,
      gameName,
      date,
      location: location ?? undefined,
      durationMinutes: 0, // Not stored in current schema
      players,
      endgamePhotoUrl: undefined, // Not stored in current schema
      notes: notes || undefined,
    });
  }

  return logs.sort((a, b) => b.date.localeCompare(a.date));
}

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
      const scoreTexts: string[] = [];

      for (const sp of scorePages.results) {
        if (!("properties" in sp)) continue;
        const spProps = (sp as PageObjectResponse).properties;
        const pIds = extractRelationIds(spProps[PLAYER_SCORES_PLAYER_PROP]);
        const score = extractNumber(spProps[PLAYER_SCORES_SCORE_PROP]);
        const isWinner = extractCheckbox(spProps[PLAYER_SCORES_IS_WINNER_PROP]);

        for (const pid of pIds) {
          if (!playerIds.includes(pid)) playerIds.push(pid);
          // We'll reconstruct score text later
          const playerName = pid; // placeholder, resolved below
          scoreTexts.push(`${pid}:${score}${isWinner ? "[贏家]" : ""}`);
        }
      }

      const scores = scoreTexts.join(", ") || extractRichText(props[PLAYS_SCORES_PROP]);

      const players = (await Promise.all(playerIds.map(getPlayerById))).filter(
        (p) => Boolean(p.name)
      );

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