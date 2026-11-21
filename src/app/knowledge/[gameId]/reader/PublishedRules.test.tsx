import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PublishedRules from "./PublishedRules";

vi.mock("next/navigation", () => ({ useParams: () => ({ gameId: "brass" }) }));
vi.mock("@/components/EditorialDraftPreview", () => ({ default: () => <section>規則正文</section> }));
vi.mock("@/components/EditorialConversation", () => ({ default: () => <section>提問表單</section> }));
vi.mock("@/components/EditorialCommunity", () => ({ default: () => <section>討論</section> }));

const release = { version: "version-20261118", document: { blocks: [{ id: "D1", kind: "文件", fields: { 遊戲: "Brass" } }, { id: "S1", kind: "來源", fields: { 名稱: "原版規則書", 網址: "https://example.com/rules.pdf" } }] } };
beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, "", "/knowledge/brass/reader?library=Brass");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => release }));
});

it("restores reading filters for the same version without overriding an explicit shared location", async () => {
  const key = `knowledge-reading:v1:${JSON.stringify(["brass", release.version, "rules"])}`;
  sessionStorage.setItem(key, JSON.stringify({ search: "?q=支付&topic=cost", y: 0 }));
  const first = render(<PublishedRules view="rules" />);
  await screen.findByText("規則正文");
  expect(new URLSearchParams(window.location.search).get("q")).toBe("支付");
  first.unmount();
  window.history.replaceState(null, "", "/knowledge/brass/reader?q=明確搜尋");
  render(<PublishedRules view="rules" />);
  await screen.findByText("規則正文");
  expect(new URLSearchParams(window.location.search).get("q")).toBe("明確搜尋");
});
afterEach(() => vi.unstubAllGlobals());

it("shows the published scope and keeps the library query in every reading tool", async () => {
  render(<PublishedRules view="rules" />);
  expect(await screen.findByRole("heading", { name: "Brass" })).toBeInTheDocument();
  expect(screen.getByText("version-20")).toHaveAttribute("title", release.version);
  expect(screen.getByRole("link", { name: "← 規則庫" })).toHaveAttribute("href", "/knowledge?q=Brass");
  expect(screen.getByRole("link", { name: "查規則", exact: true })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "問規則", exact: true })).toHaveAttribute("href", "/knowledge/brass/reader/questions?library=Brass");
  expect(screen.queryByText("提問表單")).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("keeps reading navigation available while asking questions", async () => {
  render(<PublishedRules view="questions" />);
  expect(await screen.findByText("提問表單")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "問規則", exact: true })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "← 查規則" })).toHaveAttribute("href", "/knowledge/brass/reader?library=Brass");
});

it("retries a failed public read without sending a question", async () => {
  const fetchMock = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ok: true, json: async () => release });
  vi.stubGlobal("fetch", fetchMock);
  render(<PublishedRules view="rules" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("重試");
  fireEvent.click(screen.getByRole("button", { name: "重新載入規則" }));
  expect(await screen.findByText("規則正文")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls.every(([url]) => String(url).endsWith("editorial?public=1"))).toBe(true);
});

it("provides a return path when rules are not published", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
  render(<PublishedRules view="rules" />);
  expect(await screen.findByRole("heading", { name: "規則尚未發布" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "返回規則庫" })).toHaveAttribute("href", "/knowledge?q=Brass");
  expect(screen.queryByRole("navigation", { name: "規則工具" })).not.toBeInTheDocument();
});

it("does not silently replace an old citation with the current source", async () => {
  window.history.replaceState(null, "", "/knowledge/brass/reader/source?version=old-version&library=Brass");
  render(<PublishedRules view="source" />);
  expect(await screen.findByText("規則已更新。請回到「查規則」重新開啟原文。")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /開啟原書來源/ })).not.toBeInTheDocument();
});
