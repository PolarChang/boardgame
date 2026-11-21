import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

describe("meeting authorization boundary", () => {
  const upstream = vi.fn();
  beforeEach(() => {
    vi.stubEnv("ADMIN_PASSWORD", "existing-password");
    vi.stubEnv("MEETING_ADMIN_BRIDGE_SECRET", "server-only-secret");
    vi.stubGlobal("fetch", upstream);
    upstream.mockResolvedValue(new Response('{"admin":false}', { status: 200 }));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetAllMocks(); });
  it("rejects an incorrect original password without contacting the service", async () => {
    const response = await GET(new NextRequest("https://boardgame.test/api/meet", { headers: { "x-boardgame-admin": "wrong" } }));
    expect(response.status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("only asserts administrator authority after verifying the existing password", async () => {
    await GET(new NextRequest("https://boardgame.test/api/meet", { headers: { "x-boardgame-admin": "existing-password" } }));
    const sent = upstream.mock.calls[0][1].headers as Headers;
    expect(sent.get("x-meeting-admin")).toBe("server-only-secret");
    expect(sent.get("x-boardgame-admin")).toBeNull();
  });
  it("ignores a forged administrator assertion and forwards only the player session", async () => {
    const token = "a".repeat(64);
    await GET(new NextRequest("https://boardgame.test/api/meet", { headers: { "x-meeting-admin": "server-only-secret", cookie: `club=${token}; unrelated=private` } }));
    const sent = upstream.mock.calls[0][1].headers as Headers;
    expect(sent.get("x-meeting-admin")).toBeNull();
    expect(sent.get("cookie")).toBe(`club=${token}`);
  });
  it("rejects a cross-origin write before checking the supplied password", async () => {
    const result = await POST(new NextRequest("https://boardgame.test/api/meet", { method: "POST", headers: { origin: "https://attacker.test", "x-boardgame-admin": "existing-password" }, body: '{}' }));
    expect(result.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("fails closed when bridge configuration is missing", async () => {
    vi.stubEnv("MEETING_ADMIN_BRIDGE_SECRET", "");
    const result = await GET(new NextRequest("https://boardgame.test/api/meet", { headers: { "x-boardgame-admin": "existing-password" } }));
    expect(result.status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("preserves service denials and private response caching", async () => {
    upstream.mockResolvedValue(new Response('{"error":"限主辦人操作"}', { status: 403 }));
    const result = await POST(new NextRequest("https://boardgame.test/api/meet", { method: "POST", body: '{"action":"create"}' }));
    expect(result.status).toBe(403);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
  });
});
