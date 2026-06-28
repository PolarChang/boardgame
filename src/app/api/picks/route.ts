import { NextResponse } from "next/server";
import { BOARDGAME_NEWS_URL, type BoardGameNewsData } from "@/lib/boardgamenews";

const DEFAULT_ALL_GAMES_URL = 'https://drive.google.com/uc?export=download&id=1KklAwSPQD5nCFIxgQLF5-9V-J1qxNik7';

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cloudUrl = process.env.ALL_GAMES_JSON_URL ?? DEFAULT_ALL_GAMES_URL;
    const res = await fetch(cloudUrl, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `上游來源回應失敗：${res.status}` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as BoardGameNewsData;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch BoardGameNews picks:", error);
    return NextResponse.json(
      { error: "無法取得精選推薦資料" },
      { status: 500 }
    );
  }
}
