import { sessionKey, createSession, sessionCookie, revokeSession } from "@/lib/editorial-session";
import { NextResponse } from "next/server";
import { parseEditorial } from "@/lib/editorial";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";

export const maxDuration = 60;
type Context = { params: Promise<{ gameId: string; action?: string[] }> };
async function proxy(request: Request, context: Context) {
  const { gameId, action = [] } = await context.params;
  const path = action.join("/");
  const savedKey = sessionKey(request);
  if (path === "session" && process.env.VERCEL === "1") {
    const headers = { "Cache-Control": "private, no-store" };
    if (!["GET", "POST", "DELETE"].includes(request.method)) return NextResponse.json({ error: "找不到操作" }, { status: 404, headers });
    if (request.method !== "GET" && request.headers.get("origin") !== `${new URL(request.url).protocol}//${request.headers.get("host") || new URL(request.url).host}`) return NextResponse.json({ error: "請從本站操作" }, { status: 403, headers });
    const key = request.method === "POST" ? request.headers.get("X-Knowledge-Admin") || "" : savedKey;
    if (!key && request.method === "GET") return NextResponse.json({ authenticated: false }, { headers });
    if (!key || key.length > 1024) return NextResponse.json({ error: "請先管理登入" }, { status: 401, headers });
    try {
      const upstream = await fetch(`${(process.env.KNOWLEDGE_PRIVATE_API_URL || process.env.BOARDGAME_RULES_API_URL)}/api/knowledge/games/${encodeURIComponent(gameId)}/editorial/session`, { method: request.method, cache: "no-store", signal: AbortSignal.timeout(10000), headers: { "X-Knowledge-Admin": key, "X-Rules-API-Key": (process.env.KNOWLEDGE_PRIVATE_API_URL ? process.env.KNOWLEDGE_PRIVATE_API_KEY : process.env.RULES_API_KEY) || "" } });
      if (request.method === "GET" && upstream.status === 401) return NextResponse.json({ authenticated: false }, { headers });
      if (!upstream.ok) return NextResponse.json({ error: "無法驗證管理登入，請確認密碼或稍後重試" }, { status: upstream.status, headers });
      const data = await upstream.json();
      if (request.method === "POST" && !/^ksession\.[a-f0-9]{64}$/.test(data.token || "")) throw new Error("Invalid session");
      const response = NextResponse.json({ authenticated: request.method !== "DELETE" }, { headers });
      if (request.method !== "GET") response.cookies.set(sessionCookie, request.method === "DELETE" ? "" : data.token, { httpOnly: true, sameSite: "strict", secure: true, path: "/api/rules", maxAge: request.method === "DELETE" ? 0 : 7200 });
      return response;
    } catch { return NextResponse.json({ error: "管理登入服務暫時無法使用" }, { status: 503, headers }); }
  }
  if (path === "local-readiness" && request.method === "GET") {
    const key = savedKey || request.headers.get("X-Knowledge-Admin");
    if (!key) return NextResponse.json({ error: "請先管理登入" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
    const upstream = (process.env.KNOWLEDGE_PRIVATE_API_URL || process.env.BOARDGAME_RULES_API_URL) || "http://localhost:8000";
    if (!process.env.KNOWLEDGE_PRIVATE_API_URL && (process.env.VERCEL === "1" || !["localhost", "127.0.0.1"].includes(new URL(upstream).hostname))) return NextResponse.json({ error: "此環境未提供本機模型狀態" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    try {
      const response = await fetch(`${upstream}/api/local/readiness`, { cache: "no-store", signal: AbortSignal.timeout(5000), headers: { "X-Knowledge-Admin": key, "X-Rules-API-Key": (process.env.KNOWLEDGE_PRIVATE_API_URL ? process.env.KNOWLEDGE_PRIVATE_API_KEY : process.env.RULES_API_KEY) || "" } });
      return NextResponse.json(response.ok ? await response.json() : { error: response.status === 401 ? "請重新管理登入" : "無法確認本機模型狀態" }, { status: response.status, headers: { "Cache-Control": "private, no-store" } });
    } catch { return NextResponse.json({ error: "無法連線至本機狀態服務" }, { status: 502, headers: { "Cache-Control": "private, no-store" } }); }
  }
  if (path === "session" && request.method === "GET") return NextResponse.json({ authenticated: Boolean(savedKey) }, { headers: { "Cache-Control": "private, no-store" } });
  if ((savedKey || path === "session") && request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (!origin || origin !== `${new URL(request.url).protocol}//${request.headers.get("host") || new URL(request.url).host}`) return NextResponse.json({ error: "請從本站操作" }, { status: 403 });
  }
  if (path === "session" && request.method === "DELETE") {
    revokeSession(request);
    const response = NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "private, no-store" } });
    response.cookies.set(sessionCookie, "", { httpOnly: true, sameSite: "strict", path: "/api/rules", maxAge: 0 });
    return response;
  }
  if (path === "session" && request.method === "POST") {
    const key = request.headers.get("X-Knowledge-Admin") || "";
    if (!key || key.length > 1024) return NextResponse.json({ error: "請輸入管理密碼" }, { status: 401 });
    try {
      const checked = await fetch(`${(process.env.KNOWLEDGE_PRIVATE_API_URL || process.env.BOARDGAME_RULES_API_URL) || "http://localhost:8000"}/api/knowledge/games/${encodeURIComponent(gameId)}/editorial/history`, { cache: "no-store", signal: AbortSignal.timeout(10000), headers: { "X-Knowledge-Admin": key, "X-Rules-API-Key": (process.env.KNOWLEDGE_PRIVATE_API_URL ? process.env.KNOWLEDGE_PRIVATE_API_KEY : process.env.RULES_API_KEY) || "" } });
      if (!checked.ok) return NextResponse.json({ error: checked.status === 401 ? "管理密碼不正確" : "無法驗證管理登入" }, { status: checked.status });
      const response = NextResponse.json({ authenticated: true }, { headers: { "Cache-Control": "private, no-store" } });
      response.cookies.set(sessionCookie, createSession(key), { httpOnly: true, sameSite: "strict", secure: new URL(request.url).protocol === "https:", path: "/api/rules", maxAge: 7200 });
      return response;
    } catch { return NextResponse.json({ error: "管理登入服務暫時無法使用" }, { status: 503 }); }
  }

  const allowed = request.method === "GET" ? /^(?:imports(?:\/[a-f0-9]{32}\/(?:draft|source|document|context|locations|quality|feedback|answers|questions(?:\/[a-f0-9]{64})?|pages\/[1-9][0-9]*\/(?:blocks\/[1-9][0-9]*\/)?image))?|gemini-usage|deepseek-usage|history|versions\/[a-f0-9]{64}|visuals\/[a-f0-9]{64}|community(?:\/review)?)?$/ : request.method === "PUT" ? /^community\/contributions\/[a-f0-9]{32}\/vote$/ : /^(imports(?:\/[a-f0-9]{32}\/(?:resume|retry|document|context|ask|feedback|repair|questions(?:\/[a-f0-9]{64}\/cancel)?))?|drafts|publish|google-doc|ask|visuals\/(?:crop|upload-url|export)|community\/(?:contributions|comments|reports|review))$/;
  if (!allowed.test(path)) return NextResponse.json({ error: "找不到操作" }, { status: 404 });
  let body;
  let form: FormData | undefined;
  if (request.method === "POST" && (path === "visuals/crop" || path === "imports")) {
    const size = Number(request.headers.get("content-length"));
    if (size > 51_000_000) return NextResponse.json({ error: "來源檔案不可超過 50 MB" }, { status: 413 });
    form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof Blob) && typeof form.get("object_name") !== "string") return NextResponse.json({ error: "缺少來源檔案" }, { status: 422 });
    if (file instanceof Blob && file.size > (path === "imports" && process.env.VERCEL !== "1" ? 50_000_000 : 4_000_000)) return NextResponse.json({ error: "大於 4 MB 請使用檔案直傳" }, { status: 413 });
  } else if (["POST", "PUT"].includes(request.method)) {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 2_100_000) return NextResponse.json({ error: "整理稿不可超過 2 MB" }, { status: 413 });
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "無效的請求" }, { status: 400 }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "無效的請求" }, { status: 400 });
    if (path === "drafts") {
      if (typeof body.text !== "string") return NextResponse.json({ error: "缺少整理稿文字" }, { status: 400 });
      const parsed = parseEditorial(body.text);
      if (parsed.draftIssues?.length) return NextResponse.json({ error: "整理稿結構未通過檢查", issues: parsed.draftIssues }, { status: 422 });
      body = { document: parsed.document, base_version: body.base_version || "" };
    }
  }
  const communityHeaders: Record<string, string> = {};
  if (path.startsWith("community") && request.method !== "GET") {
    // Only Vercel's overwritten platform header is trusted. Local development uses loopback.
    const ip = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for")?.trim() : process.env.NODE_ENV === "development" ? "127.0.0.1" : undefined;
    const secret = process.env.COMMUNITY_PROXY_SECRET;
    if (!ip || !isIP(ip) || !secret) return NextResponse.json({ error: "社群連線驗證尚未設定" }, { status: 503 });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    communityHeaders["X-Community-IP"] = ip;
    communityHeaders["X-Community-Timestamp"] = timestamp;
    communityHeaders["X-Community-Signature"] = createHmac("sha256", secret).update(`${timestamp}\n${ip}`).digest("hex");
  }
  try {
    const url = new URL(request.url);
    const publicRead = url.searchParams.get("public") === "1" && (
      (request.method === "GET" && (!path || path.startsWith("visuals/") || path === "community"))
      || (request.method === "POST" && (path === "ask" || /^community\/(contributions|comments|reports)$/.test(path)))
      || (request.method === "PUT" && /^community\/contributions\/[a-f0-9]{32}\/vote$/.test(path))
    );
    url.searchParams.delete("public");
    const privateUpstream = !publicRead && process.env.KNOWLEDGE_PRIVATE_API_URL;
    const upstream = privateUpstream || process.env.BOARDGAME_RULES_API_URL || "http://localhost:8000";
    const localPreview = process.env.VERCEL !== "1" && /^imports\/[a-f0-9]{32}\/ask$/.test(path) && ["localhost", "127.0.0.1"].includes(new URL((process.env.KNOWLEDGE_PRIVATE_API_URL || process.env.BOARDGAME_RULES_API_URL) || "http://localhost:8000").hostname);
    const response = await fetch(`${upstream}/api/knowledge/games/${encodeURIComponent(gameId)}/editorial${path ? `/${path}` : ""}${url.search}`, {
      method: request.method, cache: "no-store", signal: AbortSignal.timeout(localPreview ? 180000 : 45000),
      headers: { ...(!form ? { "Content-Type": "application/json" } : {}), "X-Rules-API-Key": (privateUpstream ? process.env.KNOWLEDGE_PRIVATE_API_KEY : process.env.RULES_API_KEY) || "", "X-Knowledge-Admin": publicRead ? "" : savedKey || request.headers.get("X-Knowledge-Admin") || "", "Authorization": request.headers.get("Authorization") || "", ...communityHeaders },
      ...(form ? { body: form } : body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.ok && path === "visuals/export" && response.headers.get("content-type")?.includes("application/zip")) return new Response(response.body, { headers: { "Content-Type": "application/zip", "Cache-Control": "private, no-store", "Content-Disposition": 'attachment; filename="rules-v2.zip"' } });
    if (response.ok && (path.startsWith("visuals/") || /^imports\/[a-f0-9]{32}\/pages\/[1-9][0-9]*\/(?:blocks\/[1-9][0-9]*\/)?image$/.test(path)) && request.method === "GET") return new Response(response.body, { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
    if (response.ok && /^imports\/[a-f0-9]{32}\/source$/.test(path) && request.method === "GET") return new Response(response.body, { headers: { "Content-Type": "application/pdf", "Cache-Control": "private, no-store", "Content-Disposition": `${new URL(request.url).searchParams.get("inline") === "1" ? "inline" : "attachment"}; filename="rules-source.pdf"`, "X-Content-Type-Options": "nosniff" } });
    const data = await response.json();
    return NextResponse.json(response.ok ? data : { error: typeof data.detail === "string" ? data.detail : data.detail?.message || "整理稿服務操作失敗", code: data.detail?.code, issues: data.detail?.issues }, { status: response.status, headers: { "Cache-Control": "private, no-store", ...(response.headers.has("Retry-After") ? { "Retry-After": response.headers.get("Retry-After")! } : {}) } });
  } catch { return NextResponse.json({ error: "暫時無法連線至整理稿服務，請稍後重試；文字仍保留在此頁", code: "upstream_unavailable" }, { status: 502 }); }
}
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;

export const DELETE = proxy;
