import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { NotionGame } from "./types";

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

function parseNotionPage(page: PageObjectResponse): NotionGame | null {
  const props = page.properties;

  const bggId = extractNumber(props["BGG ID"]);
  const name = extractTitle(props["Game Title"]);

  if (!bggId || !name) {
    return null;
  }

  return {
    pageId: page.id,
    bggId,
    name,
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
