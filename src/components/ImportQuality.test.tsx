import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ImportQuality from "./ImportQuality";
afterEach(() => vi.unstubAllGlobals());
it("binds feedback to the stored answer and repairs to the displayed version", async () => {
  const fetcher = vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(url.endsWith("/quality") ? { version: "v1", findings: [{ id: "R1", page: "4", code: "table_layout", message: "欄列可能遺失" }], candidates: [] } : { message: "已保存" })));
  vi.stubGlobal("fetch", fetcher);
  render(<ImportQuality base="/imports/job" version="v1" answerId="answer1" />);
  await screen.findByText("發現 1 項疑點。");
  fireEvent.click(screen.getByRole("button", { name: "補辨識疑似缺漏（最多兩頁）" }));
  await screen.findByText("已保存");
  expect(JSON.parse(fetcher.mock.calls.find(([url]) => url.endsWith("/repair"))![1].body)).toEqual({ version: "v1" });
  fireEvent.change(screen.getByLabelText("補充說明"), { target: { value: "漏了平手最後分支" } });
  fireEvent.click(screen.getByRole("button", { name: "送出回饋" }));
  await waitFor(() => expect(fetcher.mock.calls.some(([url]) => url.endsWith("/feedback"))).toBe(true));
  expect(JSON.parse(fetcher.mock.calls.find(([url]) => url.endsWith("/feedback"))![1].body)).toEqual({ answer_id: "answer1", kind: "missing_condition", comment: "漏了平手最後分支" });
});
