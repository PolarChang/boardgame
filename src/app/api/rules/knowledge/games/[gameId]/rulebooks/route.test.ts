import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/rules/knowledge/games/[gameId]/rulebooks/route";

describe("POST /api/rules/knowledge/games/:gameId/rulebooks", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("forwards a PDF multipart upload", async () => {
    const body = new FormData();
    body.set("file", new File(["pdf content"], "rulebook.pdf", { type: "application/pdf" }));
    body.set("language", "zh-TW");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ document_id: "doc-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST({ formData: vi.fn().mockResolvedValue(body) } as unknown as Request, {
      params: Promise.resolve({ gameId: "sky-mines" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ document_id: "doc-1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/knowledge/games/sky-mines/rulebooks",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) }),
    );
  });

  it("rejects a non-PDF upload", async () => {
    const body = new FormData();
    body.set("file", new File(["not a PDF"], "notes.txt", { type: "text/plain" }));

    const response = await POST({ formData: vi.fn().mockResolvedValue(body) } as unknown as Request, {
      params: Promise.resolve({ gameId: "sky-mines" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "A PDF file is required" });
  });
});
