import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import EditorialTopicReview from "./EditorialTopicReview";
import EditorialBlockCard from "./EditorialBlockCard";
import { topicOf } from "@/lib/editorial-topics";
import { parseEditorial } from "@/lib/editorial";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const rule = `#### 規則 RULE-001
大項：開始遊戲
標題：遊戲設置
角色：全部
人數：全部
擴充：基本遊戲
內容：抽牌
條件：無
例外：無
來源：SRC-001
PDF頁碼：1
原文：Draw cards.
狀態：待確認`;
const text = `#### 來源 SRC-001\n名稱：測試\n版本：1\nPDF頁數：1\n\n${rule}`;
it("requires explicit group confirmation and changes only review status", () => {
  vi.stubGlobal("React", React); const save = vi.fn();
  render(<EditorialTopicReview text={text} onChange={save} onSelect={vi.fn()} />);
  const button = screen.getByRole("button", { name: "確認本主題 1 筆（不發布）" });
  expect(button).toBeDisabled(); fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(button);
  expect(save.mock.calls[0][0]).toContain("狀態：已確認");
  expect(save.mock.calls[0][0]).toContain("例外：無");
});
it("blocks group confirmation when unresolved content remains", () => {
  vi.stubGlobal("React", React);
  render(<EditorialTopicReview text={text.replace("例外：無", "例外：未確認")} onChange={vi.fn()} onSelect={vi.fn()} />);
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByRole("button", { name: "確認本主題 1 筆（不發布）" })).toBeDisabled();
});
it("hides empty display fields but retains uncertainty and source excerpts", () => {
  vi.stubGlobal("React", React);
  render(<EditorialBlockCard block={{ kind: "規則", id: "R", fields: { 標題: "測試", 成本: "無", 步驟: "不適用", 例外: "未確認", 原文: "Original" } }} />);
  expect(screen.queryByText("無")).not.toBeInTheDocument();
  expect(screen.queryByText("不適用")).not.toBeInTheDocument();
  expect(screen.getByText(/尚未核實/)).toBeInTheDocument();
  expect(screen.getByText("Original").closest("details")).not.toHaveAttribute("open");
});
it("groups FAQ with its referenced rule", () => {
  const doc = parseEditorial(text).document;
  expect(topicOf({ kind: "FAQ", id: "FAQ-001", fields: { 引用: "RULE-001", 問題: "如何進行？" } }, doc)).toBe("開始與回合流程");
});
