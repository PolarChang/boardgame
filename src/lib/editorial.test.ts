import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { editorialDiff, pages, parseEditorial, searchEditorial } from "./editorial";

const valid = `# 規則整理稿 v1
## 文件 META
遊戲：測試遊戲
版本：1.0
## 來源 SRC-1
名稱：原始規則
版本：1.0
PDF頁數：1
## 術語 TERM-1
中文：資源
原文：Resource
別名：物資
## 規則 R-1
大項：進行遊戲
標題：支付資源
角色：工人
人數：3,4
擴充：基本遊戲
內容：支付 2.5 資源。
不可支付負數。
條件：輪到你的回合
例外：無
來源：SRC-1
PDF頁碼：1
原文：Pay 2.5 resources. Do not pay a negative amount.
狀態：已確認
## 涵蓋 C-1
章節：行動
來源：SRC-1
PDF頁碼：1
規則：R-1
狀態：已整理`;
describe("editorial import", () => {
  it("matches whole Chinese phrases and every keyword instead of isolated characters", () => {
    const doc = parseEditorial(valid).document;
    expect(searchEditorial(doc, "找不到的規則xyz")).toHaveLength(0);
    expect(searchEditorial(doc, "支援")).toHaveLength(0);
    expect(searchEditorial(doc, "支付 資源")).toHaveLength(1);
    expect(searchEditorial(doc, "支付 不存在")).toHaveLength(0);
    expect(searchEditorial(doc, "物資 支付")).toHaveLength(1);
    expect(searchEditorial(doc, "Ｒ－１")[0].id).toBe("R-1");
  });
  it("ranks the requested rule before rules that cite it", () => {
    const doc = parseEditorial(valid).document;
    doc.blocks.push({ kind: "規則", id: "R-2", fields: { 標題: "相關條目", 相關規則: "R-1" } });
    expect(searchEditorial(doc, "r-1").map(b => b.id)).toEqual(["R-1", "R-2"]);
  });
  it("reads the complete submitted Hegemony draft without silently dropping sections", () => {
    const result = parseEditorial(readFileSync("docs/knowledge-drafts/hegemony-notebooklm-original.md", "utf8"));
    expect(result.document.blocks).toHaveLength(213);
    expect(result.document.blocks.filter(b => b.kind === "規則")).toHaveLength(114);
    expect(result.document.blocks.filter(b => b.kind === "FAQ")).toHaveLength(32);
    expect(result.issues.some(i => i.message.includes("無法辨識"))).toBe(false);
    expect(result.document.blocks.find(b => b.id === "RULE-031")?.fields.PDF頁碼).toBe("18, 33");
    expect(result.document.blocks.find(b => b.id === "RULE-025")?.fields.條件).toBe("失業工人數 > 工人階級總可用空位數 + 2。");
    expect(result.document.blocks.filter(b => ["規則", "FAQ"].includes(b.kind)).every(b => b.fields.狀態 === "待確認")).toBe(true);
    expect(result.issues.some(i => i.message.includes("RULE-194"))).toBe(true);
    const results = searchEditorial(result.document, "示威", "", "工人階級", "3");
    expect(results.some(b => b.id === "RULE-025")).toBe(true);
    expect(results.some(b => b.fields.角色 === "國家")).toBe(false);
  });
  it("accepts NotebookLM heading levels and keeps restrictions separate", () => {
    const text = valid.replace(/^## /gm, "#### ").replace("# 規則整理稿 v1", "### 規則整理稿 v1").replace("例外：無", "限制：不可主動貸款\n例外：無");
    const result = parseEditorial(text);
    expect(result.issues).toEqual([]);
    const rule = result.document.blocks.find(b => b.id === "R-1")!;
    expect(rule.fields.限制).toBe("不可主動貸款");
    expect(rule.fields.條件).toBe("輪到你的回合");
  });
  it("preserves discontinuous page references instead of filling the gaps", () => {
    expect(pages("18, 33")).toEqual([18, 33]);
    expect(pages("35，36–37, 35")).toEqual([35, 36, 37]);
    for (const invalid of ["0", "3-2", "1001", "18,,33", "第 18 頁", "1-999999999999"]) expect(pages(invalid)).toEqual([]);
  });
  it("does not mistake an unsupported heading for quoted rule text", () => {
    expect(parseEditorial(valid + "\n#### 規則 缺少合法編號").issues.some(i => i.message.includes("無法辨識"))).toBe(true);
  });
  it("preserves complete multiline content and decimals without AI rewriting", () => {
    const result = parseEditorial(valid);
    expect(result.issues).toEqual([]);
    expect(result.document.blocks.find(b => b.id === "R-1")?.fields.內容).toBe("支付 2.5 資源。\n不可支付負數。");
  });
  it("blocks publication of the unreviewed template", () => {
    expect(parseEditorial(readFileSync("public/templates/rules-editorial-v1.md", "utf8")).issues.length).toBeGreaterThan(0);
  });
  it.each([
    [valid + "\n## 規則 R-1", "編號重複"],
    [valid.replace("PDF頁數：1", "PDF頁數：2"), "涵蓋表"],
    [valid.replace("PDF頁碼：1", "PDF頁碼：9"), "超出來源頁數"],
    [valid.replace("規則：R-1", "規則：不存在"), "不存在"],
    [valid.replace("狀態：已確認", "狀態：待確認"), "尚未人工確認"],
    [valid.replace("例外：無", "例外：未確認"), "未確認內容"],
  ])("rejects incomplete or invalid manuscripts", (text, message) => {
    expect(parseEditorial(text).issues.some(i => i.message.includes(message))).toBe(true);
  });
  it("shows changed, added and removed stable ids", () => {
    const before = parseEditorial(valid).document;
    const after = parseEditorial(valid.replace("支付 2.5", "支付 3").replace("TERM-1", "TERM-2")).document;
    expect(editorialDiff(before, after).map(d => [d.id, d.change])).toEqual([["TERM-1", "刪除"], ["R-1", "修改"], ["TERM-2", "新增"]]);
  });
  it("ignores database field ordering when comparing releases", () => {
    const doc = parseEditorial(valid).document;
    const reordered = { blocks: doc.blocks.map(b => ({ ...b, fields: Object.fromEntries(Object.entries(b.fields).reverse()) })) };
    expect(editorialDiff(reordered, doc)).toEqual([]);
  });
  it("searches aliases without crossing role, player count or expansion", () => {
    const doc = parseEditorial(valid).document;
    expect(searchEditorial(doc, "物資", "", "工人", "3", "基本遊戲")).toHaveLength(1);
    expect(searchEditorial(doc, "物資", "", "其他角色", "3", "基本遊戲")).toHaveLength(0);
    expect(searchEditorial(doc, "物資", "", "工人", "2", "基本遊戲")).toHaveLength(0);
  });
});
