import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import EditorialAutoImport from "./EditorialAutoImport";

afterEach(() => vi.unstubAllGlobals());

it("shows automatic source retry without requiring manual adoption", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ jobs: [{ id: "a".repeat(32), filename: "rules.pdf", total: 3, completed_pages: [1], status: "review", error: "", source_task: { state: "waiting_retry", retry_at: 100, attempts: 2, error: "OSError" } }] }) }));
  render(<EditorialAutoImport gameId="game" password="admin" disabled={false} onPreview={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "重新整理匯入任務" }));
  expect(await screen.findByText(/原文提取暫時失敗/)).toHaveTextContent("自動重試；已完成來源仍可閱讀");
  expect(screen.getByRole("link", { name: "閱讀與查詢匯入內容" })).toBeInTheDocument();
});

it("requires admin and previews a partial draft without applying it", async () => {
  const onPreview = vi.fn();
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ jobs: [{ id: "a".repeat(32), filename: "rules.pdf", total: 40, completed_pages: [1], status: "paused", error: "已保留完成頁面", unresolved_blocks: 2, warning_pages: 1 }] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ text: "# 規則整理稿 v1" }) });
  vi.stubGlobal("fetch", fetcher);
  const view = render(<EditorialAutoImport gameId="game" password="" disabled={false} onPreview={onPreview} />);
  expect(screen.getByRole("button", { name: "重新整理匯入任務" })).toBeDisabled();
  view.rerender(<EditorialAutoImport gameId="game" password="admin" disabled={false} onPreview={onPreview} />);
  fireEvent.click(screen.getByRole("button", { name: "重新整理匯入任務" }));
  expect(await screen.findByText("已暫停 · 1／40 頁")).toBeInTheDocument();
  expect(screen.getByText(/2 個區塊尚未取得可靠結果/)).toBeInTheDocument();
  expect(onPreview).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "預覽待校對稿" }));
  await vi.waitFor(() => expect(onPreview).toHaveBeenCalledWith("# 規則整理稿 v1"));
});


it("does not insert a delayed draft after switching games", async () => {
  const onPreview = vi.fn();
  let finish: (value: unknown) => void = () => {};
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ jobs: [{ id: "a".repeat(32), filename: "rules.pdf", total: 1, completed_pages: [1], status: "review", error: "" }] }) }).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })));
  const view = render(<EditorialAutoImport gameId="first" password="admin" disabled={false} onPreview={onPreview} />);
  fireEvent.click(screen.getByRole("button", { name: "重新整理匯入任務" }));
  fireEvent.click(await screen.findByRole("button", { name: "預覽待校對稿" }));
  view.rerender(<EditorialAutoImport gameId="second" password="admin" disabled={false} onPreview={onPreview} />);
  finish({ ok: true, json: async () => ({ text: "old draft" }) });
  await vi.waitFor(() => expect(screen.getByRole("button", { name: "重新整理匯入任務" })).toBeEnabled());
  expect(onPreview).not.toHaveBeenCalled();
});


it("downloads the private source with an admin header", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ jobs: [{ id: "a".repeat(32), filename: "rules.pdf", total: 1, completed_pages: [], status: "paused", error: "" }] }) }).mockResolvedValueOnce({ ok: true, blob: async () => new Blob(["%PDF-"]) });
  vi.stubGlobal("fetch", fetcher);
  const create = vi.fn().mockReturnValue("blob:source");
  vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: vi.fn() });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(<EditorialAutoImport gameId="game" password="admin" disabled={false} onPreview={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "重新整理匯入任務" }));
  fireEvent.click(await screen.findByRole("button", { name: "下載來源 PDF 核對" }));
  expect(screen.getByRole("link", { name: "閱讀與查詢匯入內容" })).toHaveAttribute("href", `/knowledge/game/imports/${"a".repeat(32)}`);
  await vi.waitFor(() => expect(click).toHaveBeenCalledOnce());
  expect(fetcher.mock.calls[1][1].headers).toEqual({ "X-Knowledge-Admin": "admin" });
  expect(create).toHaveBeenCalledOnce();
  click.mockRestore();
});

it("retries only unresolved blocks without applying a draft", async () => {
  const job = { id: "a".repeat(32), filename: "rules.pdf", total: 1, completed_pages: [1], status: "review", error: "", unresolved_blocks: 2 };
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ jobs: [job] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({}) }).mockResolvedValueOnce({ ok: true, json: async () => ({ jobs: [{ ...job, status: "queued", pending_retry_blocks: 2 }] }) });
  vi.stubGlobal("fetch", fetcher);
  const onPreview = vi.fn();
  render(<EditorialAutoImport gameId="game" password="admin" disabled={false} onPreview={onPreview} />);
  fireEvent.click(screen.getByRole("button", { name: "重新整理匯入任務" }));
  fireEvent.click(await screen.findByRole("button", { name: "只重試待辨識區塊" }));
  expect(await screen.findByText(/尚有 2 個區塊等待重試/)).toBeInTheDocument();
  expect(fetcher.mock.calls[1][0]).toContain(`/${job.id}/retry`);
  expect(fetcher.mock.calls[1][1].method).toBe("POST");
  expect(onPreview).not.toHaveBeenCalled();
});

it("shows readable source progress independently of model completion", async () => {
  const job = { id: "a".repeat(32), filename: "rules.pdf", total: 3, completed_pages: [], status: "queued", error: "", lifecycle: { stage: "searchable", searchable: true, readable_pages: 1, total_pages: 3, wait_reason: "worker_queue", content_verified: false } };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ jobs: [job] }) }));
  render(<EditorialAutoImport gameId="game" password="admin" disabled={false} onPreview={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "重新整理匯入任務" }));
  expect(await screen.findByText("可讀 1／3 頁")).toBeVisible();
  const details = screen.getByText("處理明細").closest("details");
  expect(details).not.toHaveAttribute("open");
  fireEvent.click(screen.getByText("處理明細"));
  expect(details).toHaveAttribute("open");
  expect(screen.getByText(/來源已可查詢/)).toBeVisible();
  expect(screen.getByRole("link", { name: "閱讀與查詢匯入內容" })).toBeInTheDocument();
});

it("shows the scheduled import recovery without applying a draft", async () => {
  const onPreview = vi.fn();
  const job = { id: "a".repeat(32), filename: "rules.pdf", total: 3, completed_pages: [1], status: "paused", error: "等待本機服務", resume_at: 2000000000 };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ jobs: [job] }) }));
  render(<EditorialAutoImport gameId="game" password="admin" disabled={false} onPreview={onPreview} />);
  fireEvent.click(screen.getByRole("button", { name: "重新整理匯入任務" }));
  expect(await screen.findByText(/自動恢復排程；已完成來源仍可閱讀/)).toBeInTheDocument();
  expect(onPreview).not.toHaveBeenCalled();
});

it("shows existing imports after session restoration without a refresh click", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    jobs: [{ id: "a".repeat(32), filename: "已有規則.pdf", total: 1, completed_pages: [1], status: "review", error: "" }],
  }) });
  vi.stubGlobal("fetch", fetcher);
  render(<EditorialAutoImport gameId="game" password="" sessionActive disabled={false} onPreview={vi.fn()} />);
  expect(await screen.findByText("已有規則.pdf")).toBeVisible();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
