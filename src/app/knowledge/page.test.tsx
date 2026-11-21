import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import KnowledgePage from "./page";

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => window.history.replaceState(null, "", "/knowledge"));

it("takes a player to published rules without a management form", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    games: [{ id: "ark", name: "Ark Nova" }, { id: "brass", name: "Brass" }],
  }) }));
  render(<KnowledgePage />);
  expect(await screen.findByRole("link", { name: "Ark Nova" })).toHaveAttribute("href", "/knowledge/ark/reader");
  expect(screen.getByRole("link", { name: "管理員入口" })).toHaveAttribute("href", "/knowledge/admin");
  expect(screen.queryByLabelText("管理登入密碼")).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "brass" } });
  expect(screen.queryByRole("link", { name: "Ark Nova" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Brass" })).toBeInTheDocument();
});

it("restores a shareable search and includes it in the reading return path", async () => {
  window.history.replaceState(null, "", "/knowledge?q=Brass");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ games: [{ id: "brass", name: "Brass" }, { id: "ark", name: "Ark Nova" }] }) }));
  render(<KnowledgePage />);
  const link = await screen.findByRole("link", { name: "Brass" });
  expect(screen.getByRole("searchbox")).toHaveValue("Brass");
  expect(link).toHaveAttribute("href", "/knowledge/brass/reader?library=Brass");
  expect(screen.queryByRole("link", { name: "Ark Nova" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "清除搜尋" }));
  expect(window.location.search).toBe("");
  expect(screen.getByRole("link", { name: "Ark Nova" })).toBeInTheDocument();
});

it("keeps the query through a failed load and retries only when requested", async () => {
  const fetchMock = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ok: true, json: async () => ({ games: [{ id: "brass", name: "Brass" }] }) });
  vi.stubGlobal("fetch", fetchMock);
  render(<KnowledgePage />);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Brass" } });
  expect(await screen.findByRole("alert")).toHaveTextContent("搜尋內容會保留");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "重新載入規則庫" }));
  expect(await screen.findByRole("link", { name: "Brass" })).toBeInTheDocument();
  expect(screen.getByRole("searchbox")).toHaveValue("Brass");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("recovers from no matches and restores search on browser navigation", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ games: [{ id: "ark", name: "Ark Nova" }] }) }));
  render(<KnowledgePage />);
  await screen.findByRole("link", { name: "Ark Nova" });
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "不存在" } });
  expect(screen.getByText("找不到符合的遊戲")).toBeInTheDocument();
  expect(new URLSearchParams(window.location.search).get("q")).toBe("不存在");
  fireEvent.click(screen.getByRole("button", { name: "查看所有遊戲" }));
  expect(screen.getByRole("link", { name: "Ark Nova" })).toBeInTheDocument();
  window.history.pushState(null, "", "/knowledge?q=Ark");
  fireEvent(window, new PopStateEvent("popstate"));
  expect(screen.getByRole("searchbox")).toHaveValue("Ark");
});

it.each([{ games: [] }, { games: null }])("shows an actionable empty or invalid response: %j", async data => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
  render(<KnowledgePage />);
  if (data.games === null) expect(await screen.findByRole("alert")).toBeInTheDocument();
  else expect(await screen.findByRole("link", { name: "前往找遊戲" })).toHaveAttribute("href", "/");
});
