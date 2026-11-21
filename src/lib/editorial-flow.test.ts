import { expect, it } from "vitest";
import { entryFlowNodes, validateFlows } from "./editorial-flow";
import { parseEditorial, serializeEditorial, type EditorialDocument } from "./editorial";
import { replaceEditorialBlock } from "./editorial-local";

export function flowDocument(): EditorialDocument {
  return {blocks:[
    {kind:"規則",id:"R1",fields:{標題:"支付資源"}},
    {kind:"規則",id:"R2",fields:{標題:"結束回合"}},
    {kind:"FAQ",id:"F1",fields:{引用:"R1",問題:"如何支付？"}},
    {kind:"流程",id:"FLOW",fields:{名稱:"回合流程",範圍:"回合",起點:"N1",狀態:"已確認"}},
    {kind:"流程節點",id:"N1",fields:{流程:"FLOW",標題:"行動",順序:"1",規則:"R1",角色:"全部",人數:"全部",擴充:"全部",結束:"否",狀態:"已確認"}},
    {kind:"流程節點",id:"N2",fields:{流程:"FLOW",標題:"結算",順序:"2",規則:"R2",角色:"全部",人數:"全部",擴充:"全部",結束:"是",狀態:"已確認"}},
    {kind:"流程連線",id:"E1",fields:{流程:"FLOW",起點:"N1",終點:"N2",條件:"沒有剩餘行動",順序:"1",循環:"否",狀態:"已確認"}},
    {kind:"流程連線",id:"E2",fields:{流程:"FLOW",起點:"N1",終點:"N1",條件:"還有行動",順序:"2",循環:"是",狀態:"已確認"}},
  ]};
}
it("round-trips optional flow metadata and edits only the selected flow block", () => {
  const doc = flowDocument();
  const text = serializeEditorial(doc);
  expect(text).toMatch(/^# 規則整理稿 v2/);
  expect(parseEditorial(text).document).toEqual(doc);
  expect(parseEditorial(text).draftIssues).toEqual([]);
  const changed = replaceEditorialBlock(text, "N1", {...doc.blocks[4].fields,標題:"新的行動",狀態:"待確認"});
  const parsed = parseEditorial(changed).document;
  expect(parsed.blocks.filter(b => b.id !== "N1")).toEqual(doc.blocks.filter(b => b.id !== "N1"));
  expect(parsed.blocks[4].fields.標題).toBe("新的行動");
});
it("accepts a labelled loop with an ending and maps FAQ through its own cited rules", () => {
  const doc = flowDocument();
  expect(validateFlows(doc)).toEqual([]);
  expect(entryFlowNodes(doc, doc.blocks[2], "FLOW").map(n => n.id)).toEqual(["N1"]);
  expect(entryFlowNodes(doc, doc.blocks[2], "OTHER")).toEqual([]);
});
it("rejects unmarked cycles, missing rules, dangling or cross-flow edges and disconnected nodes", () => {
  const doc = flowDocument();
  doc.blocks[7].fields.循環 = "否";
  doc.blocks[4].fields.規則 = "missing";
  expect(validateFlows(doc).map(i => i.message)).toEqual(expect.arrayContaining(["循環連線須明確標記", "流程引用的規則不存在於此版本"]));
  doc.blocks[6].fields.終點 = "OTHER-NODE";
  const messages = validateFlows(doc).map(i => i.message);
  expect(messages).toContain("連線端點不存在於此流程");
  expect(messages).toContain("節點無法從流程起點到達");
  expect(messages).toContain("節點沒有通往結束的路徑");
});
it("allows incomplete flows in drafts but blocks publication and duplicate branch labels", () => {
  const doc = flowDocument();
  doc.blocks[3].fields.狀態 = "待確認";
  doc.blocks[7].fields.條件 = doc.blocks[6].fields.條件;
  expect(parseEditorial(serializeEditorial(doc)).draftIssues).toEqual([]);
  expect(validateFlows(doc).map(i => i.message)).toContain("流程尚未人工確認，不可發布");
  expect(validateFlows(doc).map(i => i.message)).toContain("分支條件不可重複");
});
