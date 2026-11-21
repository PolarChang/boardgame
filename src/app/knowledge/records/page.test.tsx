import { webcrypto } from "node:crypto";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { saveKnowledgeAnswer } from "@/lib/knowledge-records";
import SavedAnswersPage from "./page";

beforeEach(() => {
  localStorage.clear(); window.history.replaceState(null, "", "/knowledge/records");
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: "new-version" }) }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function savedRecord() {
  return saveKnowledgeAnswer(localStorage, "game", "old-version", { blocks: [
    { kind: "文件", id: "D1", fields: { 遊戲: "桌遊" } },
    { kind: "規則", id: "R1", fields: { 標題: "支付規則", 內容: "舊版支付二枚", 原文: "Pay two resources.", PDF頁碼: "2", 來源: "S1" } },
    { kind: "來源", id: "S1", fields: { 名稱: "原版規則", 版本: "初版", 網址: "https://example.com/old.pdf" } },
  ] }, { question: "要支付多少？", answer: { answer: "原保存答案", kind: "faq", citations: ["R1"] } }, { question: "《桌遊》執行支付動作時，需要支付多少資源？", confirmed: true });
}

it("opens a saved answer with its old source snapshot while reporting a newer release", async () => {
  const record = await savedRecord();
  window.history.replaceState(null, "", `/knowledge/records?id=${record.id}`);
  render(<SavedAnswersPage />);
  expect(await screen.findByText("原保存答案")).toBeInTheDocument();
  expect(await screen.findByText(/規則已更新/)).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "參考原文" })).getByText("Pay two resources.")).toBeVisible();
  fireEvent.click(screen.getByText("保存時的整理稿與來源資訊"));
  fireEvent.click(screen.getByText("核對引用 R1"));
  expect(screen.getByText("舊版支付二枚")).toBeInTheDocument();
  expect(screen.getByText("原發布版本：old-version")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(vi.mocked(fetch).mock.calls[0][0])).toMatch(/editorial\?public=1$/);
});

it("offers a route back to the library when there are no saved answers", async () => {
  render(<SavedAnswersPage />);
  expect(await screen.findByText("還沒有保存答案")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "前往規則庫" })).toHaveAttribute("href", "/knowledge");
  expect(fetch).not.toHaveBeenCalled();
});

it("reports an unavailable browser store without erasing existing data", async () => {
  vi.spyOn(Storage.prototype, "length", "get").mockImplementation(() => { throw new Error("blocked"); });
  render(<SavedAnswersPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("原有紀錄不會被清除");
  expect(screen.getByRole("button", { name: "重新讀取紀錄" })).toBeInTheDocument();
});

it("keeps the saved answer readable when the current service is offline", async () => {
  const record = await savedRecord();
  window.history.replaceState(null, "", `/knowledge/records?id=${record.id}`);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<SavedAnswersPage />);
  expect(await screen.findByText(/無法確認目前發布版本/)).toBeInTheDocument();
  expect(screen.getByText("原保存答案")).toBeInTheDocument();
});
