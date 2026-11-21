import { describe, expect, it } from "vitest";
import { parseEditorial, validateDraft } from "./editorial";
import { replaceEditorialBlock } from "./editorial-local";
import { ruleVisuals } from "./editorial-visuals";

describe("drafts with original visual assets", () => {
  it("allows unfinished drafts to save without making them publishable", () => {
    const parsed = parseEditorial("## 規則 R1\n標題：測試\n狀態：待確認");
    expect(parsed.draftIssues).toEqual([]);
    expect(parsed.issues.length).toBeGreaterThan(0);
    expect(validateDraft({ blocks: [...parsed.document.blocks, ...parsed.document.blocks] })).toContainEqual({ id: "R1", message: "編號重複" });
  });
  it("preserves image metadata and following blocks while editing", () => {
    const text = "# 規則整理稿 v2\n## 圖片 VIS-1\n名稱：代幣\n狀態：待確認\n## 規則 R1\n標題：支付資源\n";
    const edited = replaceEditorialBlock(text, "VIS-1", { 名稱: "罷工代幣", 狀態: "待確認" });
    const parsed = parseEditorial(edited);
    expect(parsed.draftIssues).toEqual([]);
    expect(parsed.document.blocks.map(b => b.id)).toEqual(["VIS-1", "R1"]);
    expect(parsed.document.blocks[1].fields.標題).toBe("支付資源");
  });
  it("excludes private and unconfirmed images and preserves image ordering and release", () => {
    const base = { kind: "圖片", id: "V1", fields: { 資產: "a".repeat(64), 名稱: "代幣", 替代文字: "紅色圓形", 相關規則: "R1,R2", 狀態: "已確認", 公開: "是", 順序: "2", 來源: "S1", PDF頁碼: "3" } };
    const document = { blocks: [base, { ...base, id: "private", fields: { ...base.fields, 公開: "否" } }, { ...base, id: "pending", fields: { ...base.fields, 狀態: "待確認" } }, { ...base, id: "first", fields: { ...base.fields, 順序: "0" } }] };
    expect(ruleVisuals(document, "R1", "release-1").map(v => v.block_id)).toEqual(["first", "V1"]);
    expect(ruleVisuals(document, "R2", "release-1")[0]).toMatchObject({ version: "release-1", page: 3, alt: "紅色圓形" });
    expect(ruleVisuals(document, "unrelated", "release-1")).toEqual([]);
  });
});
