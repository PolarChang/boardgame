import { NextResponse } from "next/server";

const RULES_API_URL = process.env.BOARDGAME_RULES_API_URL || "http://localhost:8000";
const RULES_API_KEY = process.env.RULES_API_KEY;

export async function POST(request: Request, context: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.object_name !== "string" || typeof body.filename !== "string") return NextResponse.json({ error: "Uploaded PDF reference is required" }, { status: 400 });
  try {
    const response = await fetch(`${RULES_API_URL}/api/knowledge/games/${encodeURIComponent(gameId)}/rulebooks/import`, {
      method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", ...(RULES_API_KEY ? { "X-Rules-API-Key": RULES_API_KEY } : {}) }, body: JSON.stringify(body), cache: "no-store",
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch { return NextResponse.json({ error: "Failed to connect to rules knowledge service" }, { status: 502 }); }
}
