import { NextResponse } from "next/server";
import { sessionKey } from "@/lib/editorial-session";
import { GET as readSession, POST as createSession, DELETE as deleteSession } from "../games/[gameId]/editorial/[[...action]]/route";

export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };

async function session(request: Request) {
  const key = request.method === "POST" ? request.headers.get("X-Knowledge-Admin") || "" : sessionKey(request);
  if (!key) return NextResponse.json(request.method === "GET" ? { authenticated: false } : { error: "請輸入管理密碼" }, { status: request.method === "GET" ? 200 : 401, headers });
  if (key.length > 1024) return NextResponse.json({ error: "無效的管理登入" }, { status: 401, headers });
  if (request.method !== "GET") {
    const url = new URL(request.url);
    if (request.headers.get("origin") !== `${url.protocol}//${request.headers.get("host") || url.host}`) return NextResponse.json({ error: "請從本站操作" }, { status: 403, headers });
  }
  try {
    const upstream = process.env.KNOWLEDGE_PRIVATE_API_URL || process.env.BOARDGAME_RULES_API_URL || "http://localhost:8000";
    const response = await fetch(`${upstream}/api/knowledge/games`, { cache: "no-store", signal: AbortSignal.timeout(10000), headers: {
      "X-Knowledge-Admin": key,
      "X-Rules-API-Key": (process.env.KNOWLEDGE_PRIVATE_API_URL ? process.env.KNOWLEDGE_PRIVATE_API_KEY : process.env.RULES_API_KEY) || "",
    } });
    if (response.status === 401) return NextResponse.json(request.method === "GET" ? { authenticated: false } : { error: "管理登入已失效或密碼不正確" }, { status: request.method === "GET" ? 200 : 401, headers });
    if (!response.ok) throw new Error("upstream unavailable");
    const data = await response.json();
    const game = data.games?.find((item: { id?: unknown }) => typeof item.id === "string" && item.id.length > 0);
    if (!game) return NextResponse.json({ error: "規則庫尚未初始化，請先由管理者建立第一款遊戲。" }, { status: 409, headers });
    // Resolve an existing game only after authorization; reuse the established
    // session issuer and revocation flow without exposing the private catalogue.
    const context = { params: Promise.resolve({ gameId: game.id as string, action: ["session"] }) };
    return request.method === "POST" ? createSession(request, context) : request.method === "DELETE" ? deleteSession(request, context) : readSession(request, context);
  } catch { return NextResponse.json({ error: "登入服務暫時無法連線，請稍後重試" }, { status: 503, headers }); }
}
export const GET = session;
export const POST = session;
export const DELETE = session;
