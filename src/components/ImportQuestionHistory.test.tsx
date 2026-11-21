import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ImportQuestionHistory from "./ImportQuestionHistory";

afterEach(() => vi.unstubAllGlobals());

it("reopens an ordinary saved answer with its original snapshot and feedback identity", async () => {
  const job = { id: "saved", status: "completed", created_at: 1, question: { question: "一般試問", version: "a".repeat(64) }, result: { answer: "原答案", answer_id: "saved" }, error: "" };
  const fetcher = vi.fn(async (_path: string) => ({ ok: true, json: async () => ({ jobs: [job] }) }));
  vi.stubGlobal("fetch", fetcher);
  const open = vi.fn().mockResolvedValue(undefined);
  render(<ImportQuestionHistory base="/private" mode="answers" onOpen={open} />);
  fireEvent.click(await screen.findByText("查看保存的回答"));
  expect(fetcher.mock.calls[0][0]).toBe("/private/answers?offset=0");
  expect(open).toHaveBeenCalledWith(job);
  expect(screen.queryByText("取消問答")).not.toBeInTheDocument();
});

it("restores queue state after remount and cancels without submitting another question", async () => {
  let status = "queued";
  const fetcher = vi.fn(async (path: string, options?: RequestInit) => {
    if (options?.method === "POST") { expect(path).toBe("/private/questions/id/cancel"); status = "cancelled"; return { ok: true, json: async () => ({ status }) }; }
    return { ok: true, json: async () => ({ jobs: [{ id: "id", status, created_at: 1, question: { question: "持久問題", version: "a".repeat(64) }, result: null, error: "" }] }) };
  });
  vi.stubGlobal("fetch", fetcher);
  const first = render(<ImportQuestionHistory base="/private" onOpen={vi.fn()} />);
  expect(await screen.findByText("持久問題")).toBeInTheDocument();
  first.unmount();
  render(<ImportQuestionHistory base="/private" onOpen={vi.fn()} />);
  fireEvent.click(await screen.findByText("取消排隊"));
  await waitFor(() => expect(screen.getByText(/已取消/)).toBeInTheDocument());
  expect(fetcher.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
});

it("shows retrieval failure without inventing an empty history", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({ error: "登入已過期" }) })));
  render(<ImportQuestionHistory base="/private" onOpen={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("登入已過期");
  expect(screen.queryByText("此頁尚無背景問答紀錄。")).not.toBeInTheDocument();
});

it("shows cancellation pending until the worker confirms it stopped", async () => {
  let status = "running";
  vi.stubGlobal("fetch", vi.fn(async (_path: string, options?: RequestInit) => {
    if (options?.method === "POST") status = "cancelling";
    return { ok: true, json: async () => ({ jobs: [{ id: "id", status, created_at: 1, question: { question: "執行中的問題", version: "a".repeat(64) }, result: null, error: "" }] }) };
  }));
  render(<ImportQuestionHistory base="/private" onOpen={vi.fn()} />);
  fireEvent.click(await screen.findByText("取消問答"));
  await waitFor(() => expect(screen.getByText(/正在取消/)).toBeInTheDocument());
  expect(screen.queryByText(/已取消/)).not.toBeInTheDocument();
});
