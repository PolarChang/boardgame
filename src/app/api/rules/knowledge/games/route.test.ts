import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/rules/knowledge/games/route";
import { NextRequest } from "next/server";

describe("GET /api/rules/knowledge/games", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("proxies the structured knowledge-game contract", async () => {
    const games = [{ id: "sky-mines", name: "Skymines", publisher: null, designer: ["Alexander Pfister"], player_count: { min: 1, max: 4 }, play_time: { min: 75, max: 150 }, complexity: "3.5", status: "published" }];
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ games }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ games });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/knowledge/games",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("returns a gateway error when the knowledge service is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const response = await GET();

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Failed to connect to rules knowledge service" });
  });
});

describe("POST /api/rules/knowledge/games", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("proxies a new structured knowledge game", async () => {
    const game = { id: "sky-mines", name: "Skymines", designer: ["Alexander Pfister"] };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(game), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new NextRequest("http://localhost/api/rules/knowledge/games", {
      method: "POST",
      body: JSON.stringify(game),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(game);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/knowledge/games",
      expect.objectContaining({ method: "POST", body: JSON.stringify(game) }),
    );
  });

  it("rejects a game without an id or name", async () => {
    const response = await POST(new NextRequest("http://localhost/api/rules/knowledge/games", {
      method: "POST",
      body: JSON.stringify({ id: "" }),
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Game id and name are required" });
  });
});
