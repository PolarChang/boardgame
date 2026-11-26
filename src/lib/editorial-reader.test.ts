import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseEditorial, searchEditorial, type EditorialDocument } from "./editorial";
import { entryPages, matchReasons, pdfPageLink, relatedEntries, sourcePageCount } from "./editorial-reader";
const doc = parseEditorial(readFileSync("docs/knowledge-drafts/hegemony-local-review.md", "utf8")).document;
it("keeps source and document boundaries when resolving FAQ page ranges", () => {
  const rules: EditorialDocument = { blocks: [
    {kind:"規則",id:"R1",fields:{來源:"S1",PDF頁碼:"2-4"}},
    {kind:"規則",id:"R2",fields:{來源:"S2",PDF頁碼:"8"}},
    {kind:"FAQ",id:"F1",fields:{引用:"R1,R2,missing"}},
  ]};
  expect(entryPages(rules, rules.blocks[2], "S1")).toEqual([2,3,4]);
  expect(entryPages(rules, rules.blocks[2], "S2")).toEqual([8]);
  expect(entryPages({blocks:[]}, rules.blocks[2], "S1")).toEqual([]);
  expect(sourcePageCount({kind:"來源",id:"S1",fields:{PDF頁數:"1000000"}})).toBe(0);
  expect(sourcePageCount({kind:"來源",id:"S1",fields:{PDF頁數:"3.5"}})).toBe(0);
});
describe("full Hegemony manuscript reader", () => {
  it("keeps all 214 blocks and locates every rule by its exact id", () => {
    expect(doc.blocks).toHaveLength(214);
    for (const block of doc.blocks.filter(b => ["規則", "FAQ"].includes(b.kind))) {
      expect(searchEditorial(doc, block.id)[0].id).toBe(block.id);
      expect(matchReasons(doc, block, block.id)).toContainEqual({field:"編號",term:block.id,alias:""});
    }
  });
  it("returns meaningful reasons for aliases and never crosses a selected role", () => {
    const results = searchEditorial(doc, "勞工階級");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(b => matchReasons(doc, b, "勞工階級").some(r => r.alias === "勞工階級"))).toBe(true);
    expect(searchEditorial(doc, "罷工", "", "不存在的角色").every(b => b.fields.角色 === "全部")).toBe(true);
    expect(searchEditorial(doc, "完全不存在的規則測試")).toHaveLength(0);
  });
  it("keeps linked FAQ answers and pending status intact", () => {
    const confirmedFaq = doc.blocks.find(b => b.id === "FAQ-001")!;
    expect(confirmedFaq).toBeDefined();
    expect(confirmedFaq.fields.狀態).toBe("已確認");
    const confirmedRelated = relatedEntries(doc, confirmedFaq);
    expect(confirmedRelated.map(b => b.id)).toEqual(["RULE-087"]);
    expect(confirmedRelated.every(b => b.fields.狀態 === "已確認")).toBe(true);

    const pendingFaq = doc.blocks.find(b => b.id === "FAQ-004")!;
    expect(pendingFaq).toBeDefined();
    expect(pendingFaq.fields.狀態).toBe("待確認");
    const pendingRelated = relatedEntries(doc, pendingFaq);
    expect(pendingRelated.map(b => b.id)).toEqual(["RULE-088"]);
    expect(pendingRelated.every(b => b.fields.狀態 === "待確認")).toBe(true);
  });
});
it("links only valid PDF page ranges and keeps website links honest", () => {
  expect(pdfPageLink("https://example.com/rules.pdf?version=2#old", "18–20")?.href).toBe("https://example.com/rules.pdf?version=2#page=18");
  expect(pdfPageLink("https://example.com/files/123", "18")?.page).toBeUndefined();
  expect(pdfPageLink("javascript:alert(1)", "1")).toBeNull();
  expect(pdfPageLink("https://example.com/rules.pdf", "未確認")?.page).toBeUndefined();
});
