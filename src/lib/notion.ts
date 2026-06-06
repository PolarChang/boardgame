import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { NotionGame, Player, PlayRecord } from "./types";

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

  if (!bggId || !name) {
    return null;
  }

  return {
    pageId: page.id,
    bggId,
    name,
    chineseName,
    comment,
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
      const playerIds = extractRelationIds(props[PLAYS_PLAYERS_PROP]);
      const scores = extractRichText(props[PLAYS_SCORES_PROP]);

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
