import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import GeminiUsage from "./GeminiUsage";

afterEach(() => vi.unstubAllGlobals());

it("shows stage usage and keeps missing historical duration explicit", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ configured: false, model: "none", free_tier_confirmed: false, requests: 0, totals: { input_tokens: 0, output_tokens: 0, thinking_tokens: 0, cached_tokens: 0, total_tokens: 0 }, unknown: {}, recent: [], local_usage: { models: [], operations: [{ operation: "qa-verify", model: "local", requests: 3, input_tokens: 100, output_tokens: 20, unknown_requests: 1, duration_seconds: 1.25, unknown_duration_requests: 2 }] } }) }));
  render(<GeminiUsage gameId="a" password="admin" />);
  fireEvent.click(screen.getByRole("button"));
  expect(await screen.findByText("核對回答 · local")).toBeInTheDocument();
  expect(screen.getByText("已知耗時 1.3 秒；2 次耗時未知")).toBeInTheDocument();
});

it("requires a password and shows unknown requests alongside reported tokens", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ configured: false, model: "gemini-3.8-flash", free_tier_confirmed: false, requests: 2, totals: { input_tokens: 10, output_tokens: 2, thinking_tokens: 3, cached_tokens: 0, total_tokens: 15 }, unknown: { input_tokens: 1, output_tokens: 1, thinking_tokens: 1, cached_tokens: 1, total_tokens: 1 }, recent: [] }) });
  vi.stubGlobal("fetch", fetcher);
  const view = render(<GeminiUsage gameId="a" password="" />);
  expect(screen.getByRole("button")).toBeDisabled();
  expect(fetcher).not.toHaveBeenCalled();
  view.rerender(<GeminiUsage gameId="a" password="admin" />);
  fireEvent.click(screen.getByRole("button"));
  expect(await screen.findByText("15（另有 1 次未知）")).toBeInTheDocument();
  view.rerender(<GeminiUsage gameId="b" password="admin" />);
  expect(screen.queryByText("15（另有 1 次未知）")).not.toBeInTheDocument();
});

it("separates local token totals from cloud usage", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ configured: true, model: "gemini-2.5-flash", free_tier_confirmed: true, requests: 0, totals: {}, unknown: {}, recent: [], local_usage: { models: [{ model: "qwen3:8b", requests: 4, input_tokens: 3375, output_tokens: 833, unknown_requests: 1 }] } }) }));
  // All cloud counters must remain independent from local counters.
  vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true, model: "gemini-2.5-flash", free_tier_confirmed: true, requests: 0, totals: { input_tokens: 0, output_tokens: 0, thinking_tokens: 0, cached_tokens: 0, total_tokens: 0 }, unknown: {}, recent: [], local_usage: { models: [{ model: "qwen3:8b", requests: 4, input_tokens: 3375, output_tokens: 833, unknown_requests: 1 }] } }) } as Response);
  render(<GeminiUsage gameId="a" password="admin" />);
  fireEvent.click(screen.getByRole("button"));
  expect(await screen.findByText(/合計 4,208 Token/)).toBeInTheDocument();
  expect(screen.getByText("已記錄 0 次請求")).toBeInTheDocument();
  expect(screen.getByText("另有 1 次用量不完整")).toBeInTheDocument();
});

it("keeps missing document and retry metadata explicit", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ configured: false, model: "none", free_tier_confirmed: false, requests: 0, totals: { input_tokens: 0, output_tokens: 0, thinking_tokens: 0, cached_tokens: 0, total_tokens: 0 }, unknown: {}, recent: [], local_usage: { models: [], documents: [{ document_id: null, operation: "import-category", model: "local", requests: 3, input_tokens: 100, output_tokens: 20, unknown_requests: 1, duration_seconds: 2, unknown_duration_requests: 1, failed_requests: 1, retry_requests: 0, unknown_outcome_requests: 2, unknown_attempt_requests: 3 }] } }) }));
  render(<GeminiUsage gameId="a" password="admin" />);
  fireEvent.click(screen.getByRole("button"));
  expect(await screen.findByText(/文件未知（歷史紀錄未提供）/)).toBeInTheDocument();
  expect(screen.getByText(/傳輸失敗 1 次 · 結果未知 2 次 · 已知重試 0 次 · 重試資訊未知 3 次/)).toBeInTheDocument();
});

it("reports cache reuse separately from model requests", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ configured: false, model: "none", free_tier_confirmed: false, requests: 0, totals: { input_tokens: 0, output_tokens: 0, thinking_tokens: 0, cached_tokens: 0, total_tokens: 0 }, unknown: {}, recent: [], local_usage: { models: [], cache_hits: [{ document_id: "book", operation: "embedding-source", model: "local", events: 2, items: 15 }] } }) }));
  render(<GeminiUsage gameId="a" password="admin" />);
  fireEvent.click(screen.getByRole("button"));
  expect(await screen.findByText(/2 次重用事件／15 個快取項目/)).toBeInTheDocument();
  expect(screen.getByText("尚無本機模型紀錄。")).toBeInTheDocument();
});
