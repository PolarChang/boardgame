import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/rules/knowledge/notion-games/route";

vi.mock("@/lib/notion", () => ({ getGamesFromNotion: vi.fn() }));
import { getGamesFromNotion } from "@/lib/notion";

describe("GET /api/rules/knowledge/notion-games", () => {
  it("maps a Notion game to a stable BGG-based knowledge id", async () => {
    vi.mocked(getGamesFromNotion).mockResolvedValue([{
      pageId: "notion-page", bggId: 123, name: "Skymines", chineseName: "天空礦坑", designer: "Alexander Pfister, Viktor Kobilke", publisher: "Deep Print", image: "", minPlayers: 1, maxPlayers: 4, bestPlayers: "", playTime: 90, complexity: 3.5, rating: 0, playCount: 0, bggLink: "",
    }]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ games: [expect.objectContaining({
      pageId: "notion-page", knowledgeGameId: "bgg-123", designer: ["Alexander Pfister", "Viktor Kobilke"],
    })] });
  });
});
