import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST, PUT, DELETE } from "./route";

const context = (action: string) => ({ params: Promise.resolve({ gameId: "game", action: action.split("/") }) });
it("proxies digest-bound original page images without caching or allowing writes", async () => {
  vi.stubEnv("KNOWLEDGE_PRIVATE_API_URL", "");
  vi.stubEnv("BOARDGAME_RULES_API_URL", "http://127.0.0.1:8013");
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "Content-Type": "image/png" } }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "原件版本不符" }), { status: 409 }));
  vi.stubGlobal("fetch", fetcher);
  const path = `imports/${"a".repeat(32)}/pages/20/image`;
  const digest = "b".repeat(64);
  const request = () => new Request(`http://local/api?digest=${digest}`, { headers: { "X-Knowledge-Admin": "admin" } });
  const response = await GET(request(), context(path));
  expect(response.headers.get("Content-Type")).toBe("image/png");
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]));
  expect(fetcher.mock.calls[0][0]).toContain(`/pages/20/image?digest=${digest}`);
  expect(fetcher.mock.calls[0][1].headers["X-Knowledge-Admin"]).toBe("admin");
  expect((await GET(request(), context(path))).status).toBe(409);
  expect((await POST(new Request("http://local/api", { method: "POST" }), context(path))).status).toBe(404);
  expect((await GET(request(), context(path.replace("20", "0")))).status).toBe(404);
});
it("routes authenticated readiness through the explicitly configured private bridge", async () => {
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("KNOWLEDGE_PRIVATE_API_URL", "https://test.trycloudflare.com");
  vi.stubEnv("KNOWLEDGE_PRIVATE_API_KEY", "private-bridge-key");
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "unavailable" })));
  vi.stubGlobal("fetch", fetcher);
  const response = await GET(new Request("https://site.test/api", { headers: { "X-Knowledge-Admin": "admin" } }), context("local-readiness"));
  expect(response.status).toBe(200);
  expect(fetcher.mock.calls[0][0]).toBe("https://test.trycloudflare.com/api/local/readiness");
  expect(fetcher.mock.calls[0][1].headers["X-Rules-API-Key"]).toBe("private-bridge-key");
});
it("uses shared revocable sessions on Vercel without returning the password", async () => {
  vi.stubEnv("VERCEL", "1"); vi.stubEnv("BOARDGAME_RULES_API_URL", "https://backend.test");
  const token = `ksession.${"a".repeat(64)}`;
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ token })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: true })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: false })))
    .mockResolvedValueOnce(new Response("{}", { status: 401 }));
  vi.stubGlobal("fetch", fetcher);
  const login = await POST(new Request("https://site.test/api", { method: "POST", headers: { origin: "https://site.test", "X-Knowledge-Admin": "unchanged-password" } }), context("session"));
  expect(await login.json()).toEqual({ authenticated: true });
  expect(login.headers.get("set-cookie")).toContain("Secure");
  expect(login.headers.get("set-cookie")).not.toContain("unchanged-password");
  const headers = { cookie: login.headers.get("set-cookie")!.split(";")[0], origin: "https://site.test" };
  expect(await (await GET(new Request("https://site.test/api", { headers }), context("session"))).json()).toEqual({ authenticated: true });
  expect(fetcher.mock.calls[1][1].headers["X-Knowledge-Admin"]).toBe(token);
  expect((await DELETE(new Request("https://site.test/api", { method: "DELETE", headers: { ...headers, origin: "https://evil.test" } }), context("session"))).status).toBe(403);
  const logout = await DELETE(new Request("https://site.test/api", { method: "DELETE", headers }), context("session"));
  expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
  expect(fetcher.mock.calls[2][1].method).toBe("DELETE");
  expect(await (await GET(new Request("https://site.test/api", { headers }), context("session"))).json()).toEqual({ authenticated: false });
});
it("keeps readiness private, local, read-only and uncached", async () => {
  vi.stubEnv("BOARDGAME_RULES_API_URL", "http://127.0.0.1:8014"); vi.stubEnv("VERCEL", "");
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "unavailable" })));
  vi.stubGlobal("fetch", fetcher);
  expect((await GET(new Request("http://local/api"), context("local-readiness"))).status).toBe(401);
  expect(fetcher).not.toHaveBeenCalled();
  const request = () => new Request("http://local/api", { headers: { "X-Knowledge-Admin": "admin" } });
  const result = await GET(request(), context("local-readiness"));
  expect(result.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await result.json()).toEqual({ status: "unavailable" });
  expect(fetcher.mock.calls[0][0]).toBe("http://127.0.0.1:8014/api/local/readiness");
  expect(fetcher.mock.calls[0][1].headers["X-Knowledge-Admin"]).toBe("admin");
  expect((await POST(new Request("http://local/api", { method: "POST" }), context("local-readiness"))).status).toBe(404);
  vi.stubEnv("VERCEL", "1");
  expect((await GET(request(), context("local-readiness"))).status).toBe(404);
  vi.stubEnv("VERCEL", ""); vi.stubEnv("BOARDGAME_RULES_API_URL", "https://example.com");
  expect((await GET(request(), context("local-readiness"))).status).toBe(404);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("forwards private context versions and preserves write conflicts", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ revision: 1 })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "情境已更新" }), { status: 409 }));
  vi.stubGlobal("fetch", fetcher);
  const path = `imports/${"a".repeat(32)}/context`;
  expect((await GET(new Request("http://local/api?settings_version=v1", { headers: { "X-Knowledge-Admin": "admin" } }), context(path))).status).toBe(200);
  expect(fetcher.mock.calls[0][0]).toContain("/context?settings_version=v1");
  const body = { settings_version: "v1", expected_revision: 0, confirmed_context: { players: "2" } };
  expect((await POST(new Request("http://local/api", { method: "POST", headers: { "X-Knowledge-Admin": "admin" }, body: JSON.stringify(body) }), context(path))).status).toBe(409);
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual(body);
});
describe("editorial proxy boundaries", () => {
  it("forwards unfinished drafts but rejects duplicate IDs before reaching the backend", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ version: "draft" })));
    vi.stubGlobal("fetch", fetcher);
    const request = (text: string) => new Request("http://local/api", { method: "POST", body: JSON.stringify({ text }) });
    expect((await POST(request("## 規則 R1\n狀態：待確認"), context("drafts"))).status).toBe(200);
    expect((await POST(request("## 規則 R1\n狀態：待確認\n## 規則 R1"), context("drafts"))).status).toBe(422);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not trust client forwarded IPs without platform identity", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("VERCEL", ""); vi.stubEnv("COMMUNITY_PROXY_SECRET", "test-secret");
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const response = await POST(new Request("http://local/api", { method: "POST", headers: { "x-forwarded-for": "1.2.3.4", "x-community-ip": "1.2.3.4" }, body: JSON.stringify({ content: "投稿" }) }), context("community/contributions"));
    expect(response.status).toBe(503); expect(fetcher).not.toHaveBeenCalled();
  });
  it("signs platform IP itself and preserves quota feedback", async () => {
    vi.stubEnv("VERCEL", "1"); vi.stubEnv("COMMUNITY_PROXY_SECRET", "test-secret");
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: { code: "account_rate_limited", message: "稍後重試" } }), { status: 429, headers: { "Retry-After": "60" } })); vi.stubGlobal("fetch", fetcher);
    const response = await PUT(new Request("http://local/api", { method: "PUT", headers: { "x-vercel-forwarded-for": "1.2.3.4", "x-community-signature": "forged" }, body: JSON.stringify({ active: true }) }), context(`community/contributions/${"a".repeat(32)}/vote`));
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(fetcher.mock.calls[0][1].headers["X-Community-Signature"]).not.toBe("forged");
    expect(await response.json()).toMatchObject({ code: "account_rate_limited", error: "稍後重試" });
  });
  it("forwards image bytes without exposing a public cache", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "Content-Type": "image/png" } })));
    const result = await GET(new Request("http://local/api?version=release"), context(`visuals/${"a".repeat(64)}`));
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
    expect(new Uint8Array(await result.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]));
  });
});


it("streams the private PDF and does not expose worker controls", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("%PDF-source", { headers: { "Content-Type": "application/pdf" } }));
  vi.stubGlobal("fetch", fetcher);
  const source = await GET(new Request("http://local/api", { headers: { "X-Knowledge-Admin": "admin" } }), context(`imports/${"a".repeat(32)}/source`));
  expect(source.headers.get("Cache-Control")).toBe("private, no-store");
  expect(source.headers.get("Content-Type")).toBe("application/pdf");
  expect(await source.text()).toBe("%PDF-source");
  expect(fetcher.mock.calls[0][1].headers["X-Knowledge-Admin"]).toBe("admin");
  const claim = await POST(new Request("http://local/api", { method: "POST", body: "{}" }), context("imports/claim"));
  expect(claim.status).toBe(404);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("proxies durable question submissions, history, status and cancellation privately", async () => {
  const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ status: "queued" }), { status: 202 }));
  vi.stubGlobal("fetch", fetcher);
  const path = `imports/${"a".repeat(32)}/questions`;
  const id = "b".repeat(64);
  const body = { request_id: "request-000000001", question: "如何準備？", version: "c".repeat(64) };
  const submitted = await POST(new Request("http://local/api", { method: "POST", headers: { "X-Knowledge-Admin": "admin" }, body: JSON.stringify(body) }), context(path));
  expect(submitted.status).toBe(202);
  expect(submitted.headers.get("Cache-Control")).toBe("private, no-store");
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(body);
  await GET(new Request("http://local/api?offset=50"), context(path));
  expect(fetcher.mock.calls[1][0]).toContain("/questions?offset=50");
  await GET(new Request("http://local/api"), context(`${path}/${id}`));
  await POST(new Request("http://local/api", { method: "POST", body: "{}" }), context(`${path}/${id}/cancel`));
  expect(fetcher).toHaveBeenCalledTimes(4);
  for (const suffix of ["claim", `${id}/finish`, `${id}/heartbeat`]) {
    expect((await POST(new Request("http://local/api", { method: "POST", body: "{}" }), context(`${path}/${suffix}`))).status).toBe(404);
  }
  expect(fetcher).toHaveBeenCalledTimes(4);
});

it("opens an explicitly requested PDF inline while retaining private caching", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("%PDF-source")));
  const result = await GET(new Request("http://local/api?inline=1"), context(`imports/${"a".repeat(32)}/source`));
  expect(result.headers.get("Content-Disposition")).toBe('inline; filename="rules-source.pdf"');
  expect(result.headers.get("Cache-Control")).toBe("private, no-store");
});

it("forwards selective retry through the admin proxy", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "queued" })));
  vi.stubGlobal("fetch", fetcher);
  const result = await POST(new Request("http://local/api", { method: "POST", headers: { "X-Knowledge-Admin": "admin" }, body: JSON.stringify({ blocks: [{ page: 20, block: 1 }] }) }), context(`imports/${"a".repeat(32)}/retry`));
  expect(result.status).toBe(200);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ blocks: [{ page: 20, block: 1 }] });
  expect(fetcher.mock.calls[0][1].headers["X-Knowledge-Admin"]).toBe("admin");
});

it("streams located source crops privately and forwards document relationships", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(new Uint8Array([137, 80, 78, 71])))
    .mockResolvedValueOnce(new Response(JSON.stringify({ document: { kind: "base", edition: "1" } })));
  vi.stubGlobal("fetch", fetcher);
  const image = await GET(new Request("http://local/api", { headers: { "X-Knowledge-Admin": "admin" } }), context(`imports/${"a".repeat(32)}/pages/2/blocks/3/image`));
  expect(image.headers.get("Content-Type")).toBe("image/png");
  expect(image.headers.get("Cache-Control")).toBe("private, no-store");
  expect(new Uint8Array(await image.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]));
  const saved = await POST(new Request("http://local/api", { method: "POST", headers: { "X-Knowledge-Admin": "admin" }, body: JSON.stringify({ kind: "base", edition: "1" }) }), context(`imports/${"a".repeat(32)}/document`));
  expect(saved.status).toBe(200);
  expect(fetcher.mock.calls[1][1].headers["X-Knowledge-Admin"]).toBe("admin");
});


it("validates login, uses an HttpOnly session, blocks cross-origin writes and logs out", async () => {
  const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ jobs: [] })));
  vi.stubGlobal("fetch", fetcher);
  const login = await POST(new Request("http://localhost/api", { method: "POST", headers: { host: "127.0.0.1:3014", origin: "http://127.0.0.1:3014", "X-Knowledge-Admin": "test-private" } }), context("session"));
  expect(login.status).toBe(200);
  const cookie = login.headers.get("set-cookie")!;
  expect(cookie.toLowerCase()).toContain("httponly");
  expect(cookie).not.toContain("test-private");
  const headers = { cookie: cookie.split(";")[0], origin: "http://localhost" };
  const status = await GET(new Request("http://localhost/api", { headers }), context("session"));
  expect(await status.json()).toEqual({ authenticated: true });
  await GET(new Request("http://localhost/api", { headers }), context("imports"));
  expect(fetcher.mock.calls.at(-1)?.[1].headers["X-Knowledge-Admin"]).toBe("test-private");
  expect((await POST(new Request("http://localhost/api", { method: "POST", headers: { ...headers, origin: "https://other.test" }, body: "{}" }), context(`imports/${"a".repeat(32)}/ask`))).status).toBe(403);
  await DELETE(new Request("http://localhost/api", { method: "DELETE", headers }), context("session"));
  expect(await (await GET(new Request("http://localhost/api", { headers }), context("session"))).json()).toEqual({ authenticated: false });
});
