import { NextRequest, NextResponse } from "next/server";

const RULES_API_URL = process.env.BOARDGAME_RULES_API_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, game, top_k } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const response = await fetch(`${RULES_API_URL}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, game, top_k: top_k || 5 }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Rules API error: ${response.status}`, detail: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to proxy rules query:", error);
    return NextResponse.json(
      { error: "Failed to connect to rules engine" },
      { status: 502 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "rules query proxy" });
}