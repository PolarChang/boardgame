import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { conversationKey, readKnowledgeRecords } from "@/lib/knowledge-records";
import EditorialConversation from "./EditorialConversation";
import type { EditorialDocument } from "@/lib/editorial";

const document: EditorialDocument = { blocks: [{ id: "R1", kind: "規則", fields: { 標題: "使用代幣", 狀態: "已確認", 角色: "工人", 人數: "3", 擴充: "基本遊戲", 原文: "Pay two resources.", 來源: "S1", PDF頁碼: "2" } }, { id: "S1", kind: "來源", fields: { 名稱: "測試規則書", 版本: "v1", 網址: "https://example.com/rules.pdf" } }] };
beforeEach(() => { sessionStorage.clear(); localStorage.clear(); vi.stubGlobal("crypto", webcrypto); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("conversation clarification", () => {
  it("preserves the question and selected context when asking for a missing referent", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ answer: "請補充元件", kind: "clarification", citations: [], missing_context: ["referent"], candidates: ["R1"] })));
    vi.stubGlobal("fetch", fetcher);
    render(<EditorialConversation gameId="game" version="v1" document={document} query="" />);
    fireEvent.change(screen.getByLabelText("角色"), { target: { value: "工人" } });
    fireEvent.change(screen.getByLabelText("問題或追問"), { target: { value: "它可以使用嗎" } });
    fireEvent.click(screen.getByRole("button", { name: "詢問" }));
    await screen.findByText("請補充元件");
    expect(screen.getByLabelText("角色")).toHaveValue("工人");
    expect(screen.getByLabelText("問題或追問")).toHaveValue("它可以使用嗎");
    fireEvent.change(screen.getByLabelText("選擇你指的規則或元件"), { target: { value: "R1" } });
    fireEvent.click(screen.getByRole("button", { name: "詢問" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    const sent = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(sent).toMatchObject({ role: "工人", version: "v1", selected_id: "R1", previous_user_question: "它可以使用嗎" });
    expect(sent.request_id).toMatch(/^[a-f0-9-]{36}$/);
  });
  it("keeps user input after a service failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "服務離線" }), { status: 503 })));
    render(<EditorialConversation gameId="game" version="v1" document={document} query="" />);
    fireEvent.change(screen.getByLabelText("問題或追問"), { target: { value: "支付多少資源" } });
    fireEvent.click(screen.getByRole("button", { name: "詢問" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("服務離線");
    expect(screen.getByLabelText("問題或追問")).toHaveValue("支付多少資源");
  });
  it("reuses the request ID after a proxy timeout with an unknown backend outcome", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "連線逾時", code: "upstream_unavailable" }), { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ answer: "支付 2 資源", kind: "faq", citations: [] })));
    vi.stubGlobal("fetch", fetcher);
    render(<EditorialConversation gameId="game" version="v1" document={document} query="" />);
    fireEvent.change(screen.getByLabelText("問題或追問"), { target: { value: "支付多少資源" } });
    fireEvent.click(screen.getByRole("button", { name: "詢問" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "詢問" }));
    await screen.findByText("支付 2 資源");
    expect(JSON.parse(fetcher.mock.calls[0][1].body).request_id).toBe(JSON.parse(fetcher.mock.calls[1][1].body).request_id);
  });
});

it("restores public questions, context and answers after leaving and returning", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ answer: "支付 2 資源", kind: "faq", citations: ["R1"] })));
  vi.stubGlobal("fetch", fetcher);
  const first = render(<EditorialConversation gameId="game" version="v1" document={document} query="" publicRead />);
  fireEvent.change(screen.getByLabelText("角色"), { target: { value: "工人" } });
  fireEvent.change(screen.getByLabelText("問題或追問"), { target: { value: "支付多少資源" } });
  fireEvent.click(screen.getByRole("button", { name: "詢問" }));
  await screen.findByText("支付 2 資源");
  const citation = screen.getByText("核對引用 R1").closest("details")!;
  citation.open = true;
  fireEvent(citation, new Event("toggle"));
  fireEvent.change(screen.getByLabelText("問題或追問"), { target: { value: "下一個問題" } });
  first.unmount();
  render(<EditorialConversation gameId="game" version="v1" document={document} query="" publicRead />);
  expect(await screen.findByText("支付 2 資源")).toBeInTheDocument();
  expect(screen.getByLabelText("問題或追問")).toHaveValue("下一個問題");
  expect(screen.getByLabelText("角色")).toHaveValue("工人");
  expect(screen.getByText("核對引用 R1").closest("details")).toHaveAttribute("open");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("isolates sessions by game and published version", async () => {
  const state = render(<EditorialConversation gameId="game" version="v1" document={document} query="" publicRead />);
  fireEvent.change(screen.getByLabelText("問題或追問"), { target: { value: "舊版本問題" } });
  state.rerender(<EditorialConversation gameId="game" version="v2" document={document} query="" publicRead />);
  expect(screen.getByLabelText("問題或追問")).toHaveValue("");
  state.rerender(<EditorialConversation gameId="other" version="v1" document={document} query="" publicRead />);
  expect(screen.getByLabelText("問題或追問")).toHaveValue("");
  state.rerender(<EditorialConversation gameId="game" version="v1" document={document} query="" publicRead />);
  expect(screen.getByLabelText("問題或追問")).toHaveValue("舊版本問題");
});

it("reuses an unknown-outcome request after remount without automatically resubmitting", async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce(new Response(JSON.stringify({ answer: "支付 2 資源", kind: "faq", citations: [] })));
  vi.stubGlobal("fetch", fetcher);
  const first = render(<EditorialConversation gameId="game" version="v1" document={document} query="" publicRead />);
  fireEvent.change(screen.getByLabelText("問題或追問"), { target: { value: "支付多少資源" } });
  fireEvent.click(screen.getByRole("button", { name: "詢問" }));
  await screen.findByRole("alert");
  const sent = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(JSON.parse(sessionStorage.getItem(conversationKey("game", "v1"))!).pending.id).toBe(sent.request_id);
  first.unmount();
  render(<EditorialConversation gameId="game" version="v1" document={document} query="" publicRead />);
  expect(fetcher).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "詢問" }));
  await screen.findByText("支付 2 資源");
  expect(JSON.parse(fetcher.mock.calls[1][1].body).request_id).toBe(sent.request_id);
});

it("saves an answer once and keeps saved records when clearing the conversation", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ answer: "支付 2 資源", kind: "faq", citations: ["R1"] }))));
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<EditorialConversation gameId="game" version="v1" document={document} query="" publicRead />);
  fireEvent.change(screen.getByLabelText("問題或追問"), { target: { value: "支付多少資源" } });
  fireEvent.click(screen.getByRole("button", { name: "詢問" }));
  fireEvent.click(await screen.findByRole("button", { name: "保存答案" }));
  fireEvent.change(screen.getByLabelText("整理後的完整問題"), { target: { value: "《測試遊戲》執行支付動作時，需要支付幾枚資源？" } });
  fireEvent.click(screen.getByLabelText("問題已說清楚適用情境，且我已核對以上原文支持回答"));
  fireEvent.click(screen.getByRole("button", { name: "確認保存參考問答" }));
  expect(await screen.findByRole("button", { name: "已保存" })).toBeDisabled();
  expect(screen.getByRole("link", { name: "查看這筆紀錄" })).toHaveAttribute("href", expect.stringMatching(/^\/knowledge\/records\?id=[a-f0-9]{64}$/));
  fireEvent.click(screen.getByRole("button", { name: "清除本頁對話" }));
  expect(screen.queryByText("支付 2 資源")).not.toBeInTheDocument();
  expect(readKnowledgeRecords(localStorage).records).toHaveLength(1);
});

it("keeps the answer visible and offers retry when saving fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ answer: "支付 2 資源", kind: "faq", citations: ["R1"] }))));
  render(<EditorialConversation gameId="game" version="v1" document={document} query="" publicRead />);
  fireEvent.change(screen.getByLabelText("問題或追問"), { target: { value: "支付多少資源" } });
  fireEvent.click(screen.getByRole("button", { name: "詢問" }));
  const save = await screen.findByRole("button", { name: "保存答案" });
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) { if (key.startsWith("knowledge-answer:")) throw new Error("full"); return original.call(this, key, value); });
  fireEvent.click(save);
  fireEvent.click(screen.getByLabelText("問題已說清楚適用情境，且我已核對以上原文支持回答"));
  fireEvent.click(screen.getByRole("button", { name: "確認保存參考問答" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("保存失敗");
  expect(screen.getByText("支付 2 資源")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "保存答案" })).toBeEnabled();
});
