import { webcrypto } from "node:crypto";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ImportQuestionSubmit from "./ImportQuestionSubmit";

const question = { question: "費用多少？", version: "a".repeat(64), settings_version: "b".repeat(64), confirmed_context: { players: "2" } };
beforeEach(() => { sessionStorage.clear(); vi.stubGlobal("crypto", webcrypto); });
afterEach(() => vi.unstubAllGlobals());

it("reuses the same request after an uncertain response and a page remount", async () => {
  const sent: { request_id: string }[] = [];
  const fetcher = vi.fn(async (_path: string, options: RequestInit) => {
    sent.push(JSON.parse(options.body as string));
    if (sent.length === 1) throw new Error("連線中斷");
    return { ok: true, json: async () => ({ status: "queued" }) };
  });
  vi.stubGlobal("fetch", fetcher);
  const onSubmitted = vi.fn();
  const view = render(<ImportQuestionSubmit base="/private" question={question} disabled={false} onSubmitted={onSubmitted} />);
  fireEvent.click(screen.getByText("提交背景問答（試用）"));
  expect(await screen.findByRole("alert")).toHaveTextContent("連線中斷");
  view.unmount();
  render(<ImportQuestionSubmit base="/private" question={question} disabled={false} onSubmitted={onSubmitted} />);
  fireEvent.click(screen.getByText("提交背景問答（試用）"));
  await waitFor(() => expect(onSubmitted).toHaveBeenCalledOnce());
  expect(sent[1]).toEqual(sent[0]);
  expect(sent[0].request_id).toMatch(/^[a-f0-9-]{36}$/);
  expect(JSON.stringify(sessionStorage)).not.toContain(question.question);
});

it("scopes request identity to the document and confirmed context", async () => {
  const sent: { request_id: string }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_path: string, options: RequestInit) => {
    sent.push(JSON.parse(options.body as string));
    return { ok: true, json: async () => ({ status: "queued" }) };
  }));
  const view = render(<ImportQuestionSubmit base="/first" question={question} disabled={false} onSubmitted={vi.fn()} />);
  fireEvent.click(screen.getByText("提交背景問答（試用）"));
  await screen.findByRole("status");
  view.rerender(<ImportQuestionSubmit base="/second" question={question} disabled={false} onSubmitted={vi.fn()} />);
  fireEvent.click(screen.getByText("提交背景問答（試用）"));
  await waitFor(() => expect(sent).toHaveLength(2));
  expect(sent[0].request_id).not.toBe(sent[1].request_id);
  await screen.findByRole("status");
  view.rerender(<ImportQuestionSubmit base="/second" question={{ ...question, confirmed_context: { players: "3" } }} disabled={false} onSubmitted={vi.fn()} />);
  fireEvent.click(screen.getByText("提交背景問答（試用）"));
  await waitFor(() => expect(sent).toHaveLength(3));
  expect(new Set(sent.map(item => item.request_id)).size).toBe(3);
});
