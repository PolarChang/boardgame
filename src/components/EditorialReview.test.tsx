import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import EditorialReview from "./EditorialReview";
import { replaceEditorialBlock, draftKey } from "@/lib/editorial-local";
import { readFileSync } from "node:fs";
const text = "### 規則整理稿 v1\n\n#### 規則 RULE-001\n標題：示威\n內容：至少多二\n原文：at least two\n狀態：已確認\n\n#### FAQ FAQ-001\n問題：何時\n答案：待確認\n";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("preserves other source blocks when saving a correction", () => {
  const updated = replaceEditorialBlock(text, "RULE-001", { 標題: "示威", 內容: "至少多兩名", 狀態: "待確認" });
  expect(updated).toContain("#### FAQ FAQ-001\n問題：何時\n答案：待確認\n");
  expect(updated).not.toContain("內容：至少多二");
  expect(draftKey("a")).not.toBe(draftKey("b"));
});
it("requires a fresh review after editing confirmed content and saves the correction", () => {
  vi.stubGlobal("React", React);
  const save = vi.fn(); render(<EditorialReview text={text} onChange={save} />);
  fireEvent.change(screen.getByLabelText("選擇校對條目"), { target: { value: "RULE-001" } });
  fireEvent.change(screen.getByLabelText("內容"), { target: { value: "至少多兩名" } });
  expect(screen.getByLabelText("狀態")).toHaveValue("待確認");
  fireEvent.click(screen.getByRole("button", { name: "儲存此條校對" }));
  expect(save.mock.calls[0][0]).toContain("內容：至少多兩名");
  expect(save.mock.calls[0][0]).toContain("狀態：待確認");
});
it("does not report pending content as confirmed after saving", () => {
  vi.stubGlobal("React", React);
  render(<EditorialReview text={readFileSync("docs/knowledge-drafts/hegemony-local-review.md", "utf8")} onChange={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("選擇校對條目"), { target: { value: "RULE-001" } });
  fireEvent.click(screen.getByRole("button", { name: "儲存此條校對" }));
  expect(screen.getAllByText(/已儲存.*仍有 1 項待辦，尚未完成確認/).length).toBeGreaterThan(0);
});
it("recalculates blockers after the edited fields are saved", () => {
  vi.stubGlobal("React", React);
  render(<EditorialReview text={readFileSync("docs/knowledge-drafts/hegemony-local-review.md", "utf8")} onChange={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("選擇校對條目"), { target: { value: "RULE-001" } });
  fireEvent.change(screen.getByLabelText("例外"), { target: { value: "未確認" } });
  fireEvent.click(screen.getByRole("button", { name: "儲存此條校對" }));
  expect(screen.getAllByText(/已儲存.*仍有 2 項待辦，尚未完成確認/).length).toBeGreaterThan(0);
});

it("keeps unsaved fields when another entry is selected", () => {
  vi.stubGlobal("React", React);
  render(<EditorialReview text={text} onChange={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("選擇校對條目"), { target: { value: "RULE-001" } });
  fireEvent.change(screen.getByLabelText("內容"), { target: { value: "尚未保存的內容" } });
  fireEvent.change(screen.getByLabelText("選擇校對條目"), { target: { value: "FAQ-001" } });
  expect(screen.getByRole("dialog", { name: "尚未儲存的修改" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "繼續編輯" }));
  expect(screen.getByLabelText("內容")).toHaveValue("尚未保存的內容");
  expect(screen.getByLabelText("選擇校對條目")).toHaveValue("RULE-001");
});
it("does not navigate or discard input if saving fails", () => {
  vi.stubGlobal("React", React);
  render(<EditorialReview text={text} onChange={() => false} />);
  fireEvent.change(screen.getByLabelText("選擇校對條目"), { target: { value: "RULE-001" } });
  fireEvent.change(screen.getByLabelText("內容"), { target: { value: "需要保留" } });
  fireEvent.change(screen.getByLabelText("選擇校對條目"), { target: { value: "FAQ-001" } });
  fireEvent.click(screen.getByRole("button", { name: "儲存並繼續" }));
  expect(screen.getByLabelText("內容")).toHaveValue("需要保留");
  expect(screen.getByLabelText("選擇校對條目")).toHaveValue("RULE-001");
});
