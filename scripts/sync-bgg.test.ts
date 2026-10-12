import { afterEach, expect, it, vi } from "vitest";

vi.mock("dotenv", () => ({ config: vi.fn() }));
vi.mock("axios", () => ({ default: { get: vi.fn() } }));
vi.mock("@notionhq/client", () => ({ Client: class {} }));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.resetModules(); });

it("reports Cloudflare rejection without logging request credentials", async () => {
  for (const name of ["NOTION_TOKEN", "NOTION_DATABASE_ID", "BGG_USERNAME", "BGG_AUTH_VALUE"]) vi.stubEnv(name, "private-test-value");
  const { default: axios } = await import("axios");
  vi.mocked(axios.get).mockResolvedValue({ status: 403, headers: { "cf-mitigated": "challenge" }, data: "private-response" });
  vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  await import("./sync-bgg");
  await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
  expect(error.mock.calls.flat().join(" ")).toContain("Cloudflare blocked");
  expect(error.mock.calls.flat().join(" ")).not.toContain("private");
  expect(axios.get).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ timeout: 30000, headers: expect.objectContaining({ "User-Agent": expect.stringContaining("BoardgameCollectionSync") }) }));
});
