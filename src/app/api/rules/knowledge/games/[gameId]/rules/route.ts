import { NextRequest, NextResponse } from "next/server";
import type { KnowledgeRuleListResponse } from "@/lib/rules-knowledge";

const RULES_API_URL = process.env.BOARDGAME_RULES_API_URL || "http://localhost:8000";
const RULES_API_KEY = process.env.RULES_API_KEY;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await context.params;
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit")) || 500, 1), 1000);
  try {
    const response = await fetch(
      `${RULES_API_URL}/api/knowledge/games/${encodeURIComponent(gameId)}/rules?limit=${limit}`,
      {
        headers: {
          Accept: "application/json",
          ...(RULES_API_KEY ? { "X-Rules-API-Key": RULES_API_KEY } : {}),
        },
        cache: "no-store",
      },
    );
    if (!response.ok) {
      return NextResponse.json(
        { error: `Rules knowledge API error: ${response.status}`, detail: await response.text() },
        { status: response.status },
      );
    }
    return NextResponse.json(await response.json() as KnowledgeRuleListResponse);
  } catch (error) {
    console.error("Failed to proxy knowledge rules:", error);
    return NextResponse.json({ error: "Failed to connect to rules knowledge service" }, { status: 502 });
  }
}
