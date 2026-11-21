import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getMeetingRegularPlayerIds, getPlayers } from "@/lib/notion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store" };

/** Only this server can assert administrator authority to the meeting service. */
async function proxy(request: NextRequest) {
  if (request.method === "POST") {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) {
      return NextResponse.json({ error: "來源無效" }, { status: 403, headers: privateHeaders });
    }
  }

  const headers = new Headers();
  const password = request.headers.get("x-boardgame-admin");
  if (password !== null) {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected || !password || Buffer.byteLength(password) !== Buffer.byteLength(expected) ||
        !timingSafeEqual(Buffer.from(password), Buffer.from(expected))) {
      return NextResponse.json({ error: "管理登入已失效，請返回桌遊清單重新登入" }, { status: 401, headers: privateHeaders });
    }
    if (!process.env.MEETING_ADMIN_BRIDGE_SECRET) {
      return NextResponse.json({ error: "團務管理服務尚未設定" }, { status: 503, headers: privateHeaders });
    }
    headers.set("x-meeting-admin", process.env.MEETING_ADMIN_BRIDGE_SECRET);
  }
  // Never forward arbitrary incoming headers, including a client-supplied bridge secret.
  const cookie = request.cookies.get("club")?.value;
  if (cookie && /^[a-f0-9]{64}$/.test(cookie)) headers.set("cookie", `club=${cookie}`);
  if (request.method === "POST") headers.set("content-type", "application/json");
  try {
    const body = request.method === "POST" ? await request.text() : undefined;
    if (body && password !== null) {
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        return NextResponse.json({ error: "無效的團務請求" }, { status: 400, headers: privateHeaders });
      }
      if (input?.action === "linkPlayer" || (input?.action === "invite" && input.notionPlayerId)) {
        const playerId = typeof input.notionPlayerId === "string" ? input.notionPlayerId.toLowerCase() : "";
        if (!(await getPlayers()).some(player => player.id.toLowerCase() === playerId)) {
          return NextResponse.json({ error: "找不到 Notion 玩家" }, { status: 400, headers: privateHeaders });
        }
      }
    }
    const response = await fetch(process.env.MEETING_SERVICE_URL || "https://table-night-tw-demo.vercel.app/api/club", {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    const outgoing = new Headers(privateHeaders);
    const session = response.headers.get("set-cookie");
    if (session) outgoing.set("set-cookie", session);
    const playerId = result.profile?.notionPlayerId;
    if (response.ok && result.admin === false && typeof playerId === "string") {
      const ids = await getMeetingRegularPlayerIds().catch((): string[] => []);
      result.regular = ids.includes(playerId.toLowerCase());
    }
    if (response.ok && result.admin === true && password !== null) {
      const ids = await getMeetingRegularPlayerIds().catch((): string[] => []);
      result.regularPlayerIds = ids;
    }
    return NextResponse.json(result, { status: response.status, headers: outgoing });
  } catch {
    return NextResponse.json({ error: "團務服務暫時無法連線，請稍後重試" }, { status: 503, headers: privateHeaders });
  }
}

export const GET = proxy;
export const POST = proxy;
