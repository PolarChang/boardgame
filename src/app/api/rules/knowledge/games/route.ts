import { NextResponse } from "next/server";
import type { KnowledgeGameInput, KnowledgeGameListResponse } from "@/lib/rules-knowledge";

const RULES_API_URL = process.env.BOARDGAME_RULES_API_URL || "http://localhost:8000";
const RULES_API_KEY = process.env.RULES_API_KEY;
const rulesHeaders = (headers: HeadersInit = {}) => ({
  ...headers,
  ...(RULES_API_KEY ? { "X-Rules-API-Key": RULES_API_KEY } : {}),
});

/**
 * Structured knowledge-base games. This deliberately differs from
 * `/api/rules/games`, which remains the legacy RAG game-name list used by the
 * existing rules-search page.
 */
export async function GET() {
  try {
    const response = await fetch(`${RULES_API_URL}/api/knowledge/games`, {
      headers: rulesHeaders({ Accept: "application/json" }),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Rules knowledge API error: ${response.status}`, detail: await response.text() },
        { status: response.status },
      );
    }

    const data = (await response.json()) as KnowledgeGameListResponse;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to proxy rules knowledge games:", error);
    return NextResponse.json(
      { error: "Failed to connect to rules knowledge service" },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  const game = await request.json().catch(() => null) as KnowledgeGameInput | null;

  if (!game || typeof game.id !== "string" || !game.id.trim() || typeof game.name !== "string" || !game.name.trim()) {
    return NextResponse.json({ error: "Game id and name are required" }, { status: 400 });
  }

  try {
    const response = await fetch(`${RULES_API_URL}/api/knowledge/games`, {
      method: "POST",
      headers: rulesHeaders({ Accept: "application/json", "Content-Type": "application/json" }),
      body: JSON.stringify(game),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Rules knowledge API error: ${response.status}`, detail: await response.text() },
        { status: response.status },
      );
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Failed to proxy knowledge game creation:", error);
    return NextResponse.json({ error: "Failed to connect to rules knowledge service" }, { status: 502 });
  }
}
