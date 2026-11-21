import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import LocalQuestionReadiness from "./LocalQuestionReadiness";
afterEach(() => vi.unstubAllGlobals());
const reply = (data: object) => new Response(JSON.stringify(data));
it("refreshes offline status without inference and checks QA independently of vision", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(reply({ status: "unavailable" }))
    .mockResolvedValueOnce(reply({ status: "models_missing", capabilities: { qa: { model: "qwen3:8b", installed: true }, import_vision: { installed: false } } }));
  vi.stubGlobal("fetch", fetcher);
  render(<LocalQuestionReadiness gameId="game" />);
  await screen.findByText(/生成問答需先啟動 Ollama/);
  expect(screen.getByText(/原文、已保存答案與來源表格可繼續使用/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "更新模型狀態" }));
  await screen.findByText(/問答模型 qwen3:8b 已安裝；尚未驗證/);
  expect(fetcher).toHaveBeenCalledTimes(2);
  for (const [url, options] of fetcher.mock.calls) {
    expect(url).toMatch(/\/local-readiness$/);
    expect(options.method).toBeUndefined();
    expect(options.cache).toBe("no-store");
  }
});
it.each([
  [reply({ status: "models_missing", capabilities: { qa: { model: "missing", installed: false } } }), /缺少問答模型 missing/],
  [reply({ unexpected: true }), /目前無法確認模型狀態/],
  [new Response("", { status: 401 }), /登入已失效/],
  [new Response("", { status: 502 }), /目前無法確認模型狀態/],
])("does not treat missing or failed readiness as ready (%#)", async (response, expected) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  render(<LocalQuestionReadiness gameId="game" />);
  await screen.findByText(expected);
  expect(screen.getByRole("button", { name: "更新模型狀態" })).toBeEnabled();
});
