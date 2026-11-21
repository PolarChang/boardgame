import { afterEach, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("does not read a private catalogue before a login is supplied", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  const response = await GET(new Request("https://site.test/api/rules/knowledge/session"));
  expect(await response.json()).toEqual({ authenticated: false });
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(fetcher).not.toHaveBeenCalled();
});
it("uses the established session issuer without returning catalogue content", async () => {
  vi.stubEnv("VERCEL", "1"); vi.stubEnv("KNOWLEDGE_PRIVATE_API_URL", "https://private.test");
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ games: [{ id: "existing-game", name: "Private" }] })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ token: "ksession." + "a".repeat(64) })));
  vi.stubGlobal("fetch", fetcher);
  const response = await POST(new Request("https://site.test/api/rules/knowledge/session", { method: "POST", headers: { origin: "https://site.test", "X-Knowledge-Admin": "admin" } }));
  expect(await response.json()).toEqual({ authenticated: true });
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  expect(fetcher.mock.calls[1][0]).toContain("existing-game/editorial/session");
});
it("rejects cross-origin login and invalid credentials", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 401 })); vi.stubGlobal("fetch", fetcher);
  const request = (origin: string) => new Request("https://site.test/api/rules/knowledge/session", { method: "POST", headers: { origin, "X-Knowledge-Admin": "wrong" } });
  expect((await POST(request("https://other.test"))).status).toBe(403);
  expect(fetcher).not.toHaveBeenCalled();
  expect((await POST(request("https://site.test"))).status).toBe(401);
});
