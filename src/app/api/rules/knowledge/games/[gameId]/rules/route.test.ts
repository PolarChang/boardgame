import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/rules/knowledge/games/[gameId]/rules/route";
import { NextRequest } from "next/server";

describe("GET /api/rules/knowledge/games/:gameId/rules", () => {
  it("proxies a bounded rule list", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ rules: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const request = new NextRequest("http://localhost/api/rules/knowledge/games/bgg-1/rules?limit=1000");

    const response = await GET(request, { params: Promise.resolve({ gameId: "bgg-1" }) });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/knowledge/games/bgg-1/rules?limit=1000",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
