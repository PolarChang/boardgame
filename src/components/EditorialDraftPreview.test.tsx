import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import EditorialDraftPreview from "./EditorialDraftPreview";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("uses imported game categories and keeps unassigned rules accessible", () => {
  render(<EditorialDraftPreview document={{ blocks: [
    {kind:"規則", id:"R1", fields:{標題:"移動規則",內容:"移動三格"}},
    {kind:"規則", id:"R2", fields:{標題:"其他內容",內容:"保留原文"}},
  ], categories: [
    {id:"chapter-move", name:"Movement", method:"pdf_bookmark", rule_ids:["R1"]},
    {id:"unassigned", name:"尚在分類", method:"unassigned", rule_ids:["R2"]},
  ]}} />);
  expect(screen.queryByRole("button", {name:"政策與投票"})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name:/Movement/}));
  expect(screen.getByRole("status")).toHaveTextContent("找到 1 筆");
  fireEvent.click(screen.getByRole("button", {name:/尚在分類/}));
  expect(screen.getByRole("button", {name:/R2/})).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name:"全部主題"}));
  expect(screen.getByRole("status")).toHaveTextContent("找到 2 筆");
});
it("keeps unassigned entries and selected rule when moving between flow and page reading", () => {
  vi.stubGlobal("React", React);
  window.history.replaceState(null, "", "/knowledge/test/reader?view=flow&flow=FLOW&node=N1&block=R1");
  render(<EditorialDraftPreview gameId="test" document={{blocks:[
    {kind:"規則",id:"R1",fields:{標題:"行動規則"}},
    {kind:"規則",id:"R2",fields:{標題:"其他規則"}},
    {kind:"FAQ",id:"F1",fields:{問題:"如何行動",引用:"R1"}},
    {kind:"流程",id:"FLOW",fields:{名稱:"單步流程",範圍:"回合",起點:"N1",狀態:"已確認"}},
    {kind:"流程節點",id:"N1",fields:{流程:"FLOW",標題:"執行行動",順序:"1",規則:"R1",角色:"全部",人數:"全部",擴充:"全部",結束:"是",狀態:"已確認"}},
  ]}} />);
  expect(screen.getByRole("status")).toHaveTextContent("找到 2 筆");
  fireEvent.click(screen.getByRole("button", {name:"其他／尚未編入此流程"}));
  expect(screen.getByRole("status")).toHaveTextContent("找到 1 筆");
  expect(screen.getByRole("heading", {name:"行動規則"})).toBeInTheDocument();
  expect(screen.getByRole("link", {name:"校對此條"}).getAttribute("href")).toContain("node%3Dunassigned");
  fireEvent.click(screen.getByRole("button", {name:"全部步驟"}));
  expect(screen.getByRole("status")).toHaveTextContent("找到 3 筆");
  fireEvent.click(screen.getByRole("button", {name:"按頁碼閱讀"}));
  expect(screen.getByRole("heading", {name:"行動規則"})).toBeInTheDocument();
  window.history.replaceState(null, "", "/");
});
it("reads source pages and coverage while preserving the selected rule and return link", () => {
  vi.stubGlobal("React", React);
  window.history.replaceState(null, "", "/knowledge/test/reader?view=pages&source=S1&page=2&block=R1");
  render(<EditorialDraftPreview gameId="test" document={{ blocks: [
    {kind:"來源",id:"S1",fields:{名稱:"基本規則",PDF頁數:"3"}},
    {kind:"規則",id:"R1",fields:{標題:"跨頁規則",內容:"支付資源",來源:"S1",PDF頁碼:"1-2"}},
    {kind:"規則",id:"R2",fields:{標題:"另一來源",來源:"S2",PDF頁碼:"2"}},
    {kind:"FAQ",id:"F1",fields:{問題:"如何支付？",答案:"支付資源",引用:"R1"}},
    {kind:"涵蓋",id:"C1",fields:{章節:"封底",來源:"S1",PDF頁碼:"3",狀態:"不適用",說明:"出版資訊"}},
  ]}} />);
  expect(screen.getByLabelText("PDF 實際頁次")).toHaveValue("2");
  expect(screen.getByRole("status")).toHaveTextContent("找到 2 筆");
  expect(screen.getByRole("link", {name:"校對此條"}).getAttribute("href")).toContain("view%3Dpages");
  fireEvent.change(screen.getByLabelText("PDF 實際頁次"), {target:{value:"3"}});
  expect(screen.getByText(/封底 · 不適用：出版資訊/)).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("找到 0 筆");
  expect(screen.getByRole("heading", {name:"跨頁規則"})).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name:"按主題查找"}));
  expect(screen.getByRole("status")).toHaveTextContent("找到 3 筆");
  expect(screen.getByRole("heading", {name:"跨頁規則"})).toBeInTheDocument();
  window.history.replaceState(null, "", "/");
});
it("recovers from combined empty search and filters with one action", () => {
  vi.stubGlobal("React", React);
  render(<EditorialDraftPreview document={{ blocks: [{ kind: "規則", id: "RULE-001", fields: { 標題: "貸款", 內容: "支付利息", 角色: "全部", 人數: "全部", 狀態: "待確認" } }] }} />);
  fireEvent.change(screen.getByLabelText("搜尋規則或 FAQ"), { target: { value: "不存在" } });
  fireEvent.change(screen.getByLabelText("規則大項"), { target: { value: "開始遊戲" } });
  expect(screen.getByText("沒有符合的條目")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "清除搜尋與篩選" }));
  expect(screen.getByLabelText("搜尋規則或 FAQ")).toHaveValue("");
  expect(screen.getByLabelText("規則大項")).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: /RULE-001/ }));
  expect(screen.getByRole("heading", { name: "貸款" })).toBeInTheDocument();
});

it("restores search and a selected entry from its shareable URL", () => {
  vi.stubGlobal("React", React);
  window.history.replaceState(null, "", "/knowledge/test/reader?q=貸款&block=RULE-001");
  render(<EditorialDraftPreview gameId="test" document={{ blocks: [{kind:"規則",id:"RULE-001",fields:{標題:"貸款",內容:"支付利息",狀態:"待確認"}}] }} />);
  expect(screen.getByLabelText("搜尋規則或 FAQ")).toHaveValue("貸款");
  expect(screen.getByRole("heading", {name:"貸款"})).toBeInTheDocument();
  expect(screen.getByRole("link", {name:"校對此條"}).getAttribute("href")).toContain("block=RULE-001");
  window.history.replaceState(null, "", "/");
});

it("filters by original chapter without hiding unassigned content permanently", () => {
  render(<EditorialDraftPreview document={{ blocks: [
    { kind: "規則", id: "A", fields: { 標題: "準備原文", 內容: "Place pieces" } },
    { kind: "規則", id: "B", fields: { 標題: "未分類原文", 內容: "Unknown source" } },
  ], chapters: [{ id: "setup", title: "Original Setup", parent_id: null, page: "2", rule_ids: ["A"] }] }} />);
  fireEvent.change(screen.getByLabelText("原書章節"), { target: { value: "setup" } });
  expect(screen.getByRole("status")).toHaveTextContent("找到 1 筆");
  fireEvent.click(screen.getByRole("button", { name: "清除搜尋與篩選" }));
  expect(screen.getByRole("status")).toHaveTextContent("找到 2 筆");
});
