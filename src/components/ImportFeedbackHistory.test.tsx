import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ImportFeedbackHistory from "./ImportFeedbackHistory";
afterEach(() => vi.unstubAllGlobals());

it("reads saved questions, answers and evidence after reopening", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ items: [{ id: "f", kind: "wrong_answer", comment: "數量不符", version: "a".repeat(64), record: { question: "費用？", answer: { answer: "支付6枚", model: "fixture" }, blocks: [{ id: "R", fields: { 原文: "Pay 5 coins.", PDF頁碼: "1" } }] } }], next_offset: null }))));
  render(<ImportFeedbackHistory base="/imports/a" />);
  fireEvent.click(screen.getByRole("button", { name: "讀取／更新回饋紀錄" }));
  expect(await screen.findByText("答錯：費用？")).toBeInTheDocument();
  expect(screen.getByText("Pay 5 coins.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "開啟當時來源版本" })).toHaveAttribute("href", `?version=${"a".repeat(64)}`);
});

it("shows a failed read and lets the user retry", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: "登入已到期" }), { status: 401 })).mockResolvedValueOnce(new Response(JSON.stringify({ items: [], next_offset: null }))));
  render(<ImportFeedbackHistory base="/imports/a" />);
  fireEvent.click(screen.getByRole("button", { name: "讀取／更新回饋紀錄" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("登入已到期");
  fireEvent.click(screen.getByRole("button", { name: "讀取／更新回饋紀錄" }));
  expect(await screen.findByText("尚無回饋紀錄。")).toBeInTheDocument();
});
