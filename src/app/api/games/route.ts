import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { XMLParser } from "fast-xml-parser";
import { getGamesFromNotion } from "@/lib/notion";

/** GET: return list of all game names from Notion (same source as game wall) */
export async function GET() {
  try {
    const games = await getGamesFromNotion();
    const gameNames = games.map((g) => ({
      pageId: g.pageId,
      name: g.name,
      chineseName: g.chineseName,
      scoreFields: g.scoreFields,
    })).sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json(gameNames);
  } catch (error) {
    console.error("Failed to fetch games:", error);
    return NextResponse.json(
      { error: "Failed to fetch games" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const databaseId = process.env.NOTION_DATABASE_ID;
  const notionToken = process.env.NOTION_TOKEN;

  if (!adminPassword || !databaseId || !notionToken) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (body?.password !== adminPassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bggId = body?.bggId;
  if (!bggId) {
    return NextResponse.json({ error: "BGG ID is required" }, { status: 400 });
  }

  try {
    const response = await fetch(`https://boardgamegeek.com/xmlapi2/thing?id=${bggId}`);
    const xmlData = await response.text();
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
    const json = parser.parse(xmlData);
    const item = json.items?.item;

    if (!item) return NextResponse.json({ error: "Game not found on BGG" }, { status: 404 });

    // 萃取資料
    const names = Array.isArray(item.name) ? item.name : [item.name];
    const primaryName = names.find((n: any) => n.type === "primary")?.value || "";
    const chineseName = names.find((n: any) => /[\u4e00-\u9fa5]/.test(n.value))?.value || "";
    const gameType = item.type === "boardgameexpansion" ? "Expansion" : "Base";
    const imageUrl = item.image || "";

    const notion = new Client({ auth: notionToken });
    const page = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        "Game Title": { title: [{ text: { content: primaryName } }] },
        "BGG ID": { number: parseInt(bggId) },
        "Chinese Name": { rich_text: [{ text: { content: chineseName } }] },
        "Type": { select: { name: gameType } },
        "Ownership": { select: { name: "Owned" } },
      },
    });

    return NextResponse.json({ success: true, pageId: page.id }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create game" }, { status: 500 });
  }
}