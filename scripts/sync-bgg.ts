/**
 * BGG → Notion one-way sync script.
 * Run via: npm run sync:bgg
 */
import { config } from "dotenv";
import { resolve } from "path";
import axios from "axios";
import { Client } from "@notionhq/client";
import type {
  CreatePageParameters,
  UpdatePageParameters,
} from "@notionhq/client/build/src/api-endpoints";
import { XMLParser } from "fast-xml-parser";

config({ path: resolve(process.cwd(), ".env.local") });

// --- Type Definitions (from docs/SYNC_PIPELINE.md) ---

interface BggGame {
  bggId: number;
  name: string;
  image: string;
  minPlayers: number;
  maxPlayers: number;
  bestPlayers: string;
  playTime: number;
  weight: number;
  rating: number;
}

interface ExistingNotionGame {
  pageId: string;
  rating: number;
  complexity: number;
}

// Protected user-owned fields — never include in create/update payloads
const PROTECTED_FIELDS = [
  "Chinese Name",
  "Comment",
  "heavy",
  "Designer",
  "My Rating",
  "Price",
  "Publisher",
  "Purchase Date",
  "Play Count",
] as const;

// --- Config ---

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
const BGG_USERNAME = process.env.BGG_USERNAME;
const BGG_AUTH_VALUE = process.env.BGG_AUTH_VALUE;

const BGG_RETRY_DELAY_MS = 3000;
const THING_BATCH_SIZE = 20;

function getBggAxiosHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "application/xml, text/xml, */*",
  };

  if (BGG_AUTH_VALUE) {
    headers.Authorization = BGG_AUTH_VALUE;
  }

  return headers;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function numbersDiffer(a: number, b: number): boolean {
  return Math.round(a * 100) !== Math.round(b * 100);
}

function extractNotionNumber(prop: {
  number: number | { format: string } | null;
}): number {
  const value = prop.number;
  return typeof value === "number" ? value : 0;
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function bggCollectionUrl(username: string): string {
  return `https://boardgamegeek.com/xmlapi2/collection?username=${username}&own=1&stats=1`;
}

function bggThingUrl(ids: number[]): string {
  return `https://boardgamegeek.com/xmlapi2/thing?id=${ids.join(",")}&stats=1`;
}

function bggBoardgameUrl(bggId: number): string {
  return `https://boardgamegeek.com/boardgame/${bggId}`;
}

// --- BGG Fetch ---

async function fetchBggXml(url: string, label: string): Promise<string> {
  console.log(`正在抓取 BGG ${label}...`);
  console.log(`  URL: ${url}`);

  while (true) {
    const response = await axios.get<string>(url, {
      headers: getBggAxiosHeaders(),
      responseType: "text",
      validateStatus: (status) => status === 200 || status === 202,
    });

    if (response.status === 202) {
      console.log(
        `BGG 伺服器處理中 (HTTP 202)，等待 ${BGG_RETRY_DELAY_MS / 1000} 秒後重試...`
      );
      await sleep(BGG_RETRY_DELAY_MS);
      continue;
    }

    const text = response.data;
    console.log(`BGG ${label} 抓取成功 (${text.length} bytes)`);
    return text;
  }
}

function extractCollectionObjectIds(xml: string): number[] {
  const parsed = xmlParser.parse(xml);
  const items = parsed?.items?.item;

  if (!items) {
    console.log("Collection 為空，沒有找到任何遊戲。");
    return [];
  }

  const objectIds = asArray(items)
    .map((item) => toNumber(item["@_objectid"]))
    .filter((id) => id > 0);

  console.log(`從 Collection 中萃取到 ${objectIds.length} 個 objectid`);
  return objectIds;
}

function parsePrimaryName(item: Record<string, unknown>): string {
  const names = asArray(item.name as Record<string, string> | Record<string, string>[]);
  const primary = names.find((n) => n["@_type"] === "primary");
  return primary?.["@_value"] ?? names[0]?.["@_value"] ?? "Unknown";
}

function parseBestPlayers(item: Record<string, unknown>): string {
  const polls = asArray(
    item.poll as Record<string, unknown> | Record<string, unknown>[]
  );
  const suggestedPoll = polls.find((p) => p["@_name"] === "suggested_numplayers");

  if (!suggestedPoll) {
    return "1";
  }

  const results = asArray(
    suggestedPoll.results as Record<string, unknown> | Record<string, unknown>[]
  );

  let maxBestVotes = -1;
  let bestNumPlayers = "1";

  for (const result of results) {
    const numPlayers = String(result["@_numplayers"] ?? "1");
    const resultEntries = asArray(
      result.result as Record<string, string> | Record<string, string>[]
    );
    const bestEntry = resultEntries.find((r) => r["@_value"] === "Best");
    const votes = toNumber(bestEntry?.["@_numvotes"], 0);

    if (votes > maxBestVotes) {
      maxBestVotes = votes;
      bestNumPlayers = numPlayers;
    }
  }

  return bestNumPlayers;
}

function parseThingItem(item: Record<string, unknown>): BggGame {
  const bggId = toNumber(item["@_id"]);
  const stats = (item.statistics as Record<string, unknown>)?.ratings as
    | Record<string, unknown>
    | undefined;

  return {
    bggId,
    name: parsePrimaryName(item),
    image: String(item.image ?? ""),
    minPlayers: toNumber((item.minplayers as Record<string, string>)?.["@_value"], 1),
    maxPlayers: toNumber((item.maxplayers as Record<string, string>)?.["@_value"], 1),
    bestPlayers: parseBestPlayers(item),
    playTime: toNumber((item.playingtime as Record<string, string>)?.["@_value"], 0),
    weight: toNumber((stats?.averageweight as Record<string, string>)?.["@_value"], 0),
    rating: toNumber((stats?.average as Record<string, string>)?.["@_value"], 0),
  };
}

function parseThingXml(xml: string): BggGame[] {
  const parsed = xmlParser.parse(xml);
  const items = parsed?.items?.item;

  if (!items) {
    return [];
  }

  return asArray(items).map((item) => parseThingItem(item as Record<string, unknown>));
}

async function fetchBggGames(objectIds: number[]): Promise<BggGame[]> {
  if (objectIds.length === 0) {
    return [];
  }

  const allGames: BggGame[] = [];

  for (let i = 0; i < objectIds.length; i += THING_BATCH_SIZE) {
    const batch = objectIds.slice(i, i + THING_BATCH_SIZE);
    const batchNum = Math.floor(i / THING_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(objectIds.length / THING_BATCH_SIZE);

    console.log(
      `正在抓取 Thing API 批次 ${batchNum}/${totalBatches} (${batch.length} 款遊戲)...`
    );

    const url = bggThingUrl(batch);
    const xml = await fetchBggXml(url, `Thing 批次 ${batchNum}`);
    const games = parseThingXml(xml);

    console.log(`  批次 ${batchNum} 解析完成，取得 ${games.length} 款遊戲`);
    allGames.push(...games);
  }

  console.log(`BGG 資料抓取完成，共 ${allGames.length} 款遊戲`);
  return allGames;
}

// --- Notion Sync ---

function buildSyncProperties(game: BggGame): CreatePageParameters["properties"] {
  const properties: CreatePageParameters["properties"] = {
    "Game Title": {
      title: [{ text: { content: game.name } }],
    },
    "BGG ID": {
      number: game.bggId,
    },
    "BGG Link": {
      url: bggBoardgameUrl(game.bggId),
    },
    "Cover Image": {
      files: game.image
        ? [{ name: "cover", type: "external", external: { url: game.image } }]
        : [],
    },
    "Min Players": {
      number: game.minPlayers,
    },
    "Max Players": {
      number: game.maxPlayers,
    },
    "Best Player Count": {
      rich_text: [{ text: { content: game.bestPlayers } }],
    },
    Playtime: {
      number: game.playTime,
    },
    Complexity: {
      number: game.weight,
    },
    "BGG Rating": {
      number: game.rating,
    },
  };

  for (const field of PROTECTED_FIELDS) {
    if (field in properties) {
      throw new Error(`Protected field "${field}" must not be included in sync payload`);
    }
  }

  return properties;
}

async function loadExistingGames(
  notion: Client,
  databaseId: string
): Promise<Map<number, ExistingNotionGame>> {
  console.log("正在查詢 Notion Database 既有資料...");

  const map = new Map<number, ExistingNotionGame>();
  let cursor: string | undefined;
  let page = 0;

  do {
    page += 1;
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
    });

    for (const result of response.results) {
      if (!("properties" in result)) continue;

      const props = result.properties;
      const bggIdProp = props["BGG ID"];
      const ratingProp = props["BGG Rating"];
      const complexityProp = props.Complexity;

      const bggId =
        bggIdProp && "number" in bggIdProp ? extractNotionNumber(bggIdProp) : 0;
      if (!bggId) continue;

      const rating =
        ratingProp && "number" in ratingProp ? extractNotionNumber(ratingProp) : 0;
      const complexity =
        complexityProp && "number" in complexityProp
          ? extractNotionNumber(complexityProp)
          : 0;

      map.set(bggId, { pageId: result.id, rating, complexity });
    }

    console.log(`  已載入第 ${page} 頁，目前共 ${map.size} 筆`);
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  console.log(`Notion 既有資料載入完成，共 ${map.size} 筆`);
  return map;
}

async function syncToNotion(
  notion: Client,
  databaseId: string,
  games: BggGame[]
): Promise<void> {
  const existing = await loadExistingGames(notion, databaseId);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  console.log(`\n開始同步 ${games.length} 款遊戲至 Notion...\n`);

  for (const game of games) {
    const record = existing.get(game.bggId);
    const properties = buildSyncProperties(game);

    if (!record) {
      await notion.pages.create({
        parent: { database_id: databaseId },
        properties,
      });
      created += 1;
      console.log(`✅ 成功新增：${game.name} (BGG ID: ${game.bggId})`);
      continue;
    }

    const ratingChanged = numbersDiffer(game.rating, record.rating);
    const complexityChanged = numbersDiffer(game.weight, record.complexity);

    if (!ratingChanged && !complexityChanged) {
      skipped += 1;
      console.log(`⏭️  跳過（BGG Rating / Complexity 無變動）：${game.name}`);
      continue;
    }

    await notion.pages.update({
      page_id: record.pageId,
      properties: properties as UpdatePageParameters["properties"],
    });
    updated += 1;

    const changes: string[] = [];
    if (ratingChanged) {
      changes.push(`BGG Rating ${record.rating} → ${game.rating}`);
    }
    if (complexityChanged) {
      changes.push(`Complexity ${record.complexity} → ${game.weight}`);
    }
    console.log(`🔄 成功更新：${game.name}（${changes.join("，")}）`);
  }

  console.log("\n--- 同步完成 ---");
  console.log(`新增：${created} 筆`);
  console.log(`更新：${updated} 筆`);
  console.log(`跳過：${skipped} 筆`);
}

// --- Main ---

async function main() {
  console.log("=== BGG → Notion 同步腳本啟動 ===\n");

  const notionToken = requireEnv("NOTION_TOKEN", NOTION_TOKEN);
  const databaseId = requireEnv("NOTION_DATABASE_ID", NOTION_DATABASE_ID);
  const bggUsername = requireEnv("BGG_USERNAME", BGG_USERNAME);
  requireEnv("BGG_AUTH_VALUE", BGG_AUTH_VALUE);

  const notion = new Client({ auth: notionToken });
  console.log("Notion Client 初始化完成");
  console.log(`BGG 使用者：${bggUsername}\n`);

  const collectionUrl = bggCollectionUrl(bggUsername);
  const collectionXml = await fetchBggXml(collectionUrl, "Collection");
  const objectIds = extractCollectionObjectIds(collectionXml);

  if (objectIds.length === 0) {
    console.log("沒有遊戲需要同步，結束。");
    return;
  }

  const games = await fetchBggGames(objectIds);
  await syncToNotion(notion, databaseId, games);

  console.log("\n=== 同步腳本執行完畢 ===");
}

main().catch((err) => {
  console.error("\n❌ 同步失敗：", err);
  process.exit(1);
});
