import type { EditorialBlock, EditorialDocument, EditorialIssue } from "./editorial";

export const flowKinds = ["流程", "流程節點", "流程連線"];
const refs = (value = "") => value.split(/[,，、\n]/).map(v => v.trim()).filter(Boolean);
const order = (block: EditorialBlock) => Number(block.fields.順序) || 0;
export function flowParts(doc: EditorialDocument, flowId: string) {
  return {
    nodes: doc.blocks.filter(b => b.kind === "流程節點" && b.fields.流程 === flowId).sort((a, b) => order(a) - order(b)),
    edges: doc.blocks.filter(b => b.kind === "流程連線" && b.fields.流程 === flowId).sort((a, b) => order(a) - order(b)),
  };
}
export function flowRuleIds(node: EditorialBlock): string[] { return refs(node.fields.規則); }
export function entryFlowNodes(doc: EditorialDocument, block: EditorialBlock, flowId: string): EditorialBlock[] {
  const ruleIds = block.kind === "FAQ" ? refs(block.fields.引用) : [block.id];
  return flowParts(doc, flowId).nodes.filter(node => flowRuleIds(node).some(id => ruleIds.includes(id)));
}

export function validateFlows(doc: EditorialDocument): EditorialIssue[] {
  const issues: EditorialIssue[] = [];
  const add = (id: string, message: string) => issues.push({id, message});
  const flows = doc.blocks.filter(b => b.kind === "流程");
  const rules = new Set(doc.blocks.filter(b => b.kind === "規則").map(b => b.id));
  for (const b of doc.blocks.filter(b => flowKinds.includes(b.kind))) {
    const required = b.kind === "流程" ? ["名稱", "範圍", "起點", "狀態"] : b.kind === "流程節點"
      ? ["流程", "標題", "順序", "規則", "角色", "人數", "擴充", "結束", "狀態"] : ["流程", "起點", "終點", "條件", "順序", "循環", "狀態"];
    for (const key of required) if (!b.fields[key]?.trim()) add(b.id, `缺少「${key}」`);
    if (b.fields.狀態 !== "已確認") add(b.id, "流程尚未人工確認，不可發布");
    if (b.kind === "流程") {
      if (!["總覽", "回合"].includes(b.fields.範圍)) add(b.id, "流程範圍須為總覽或回合");
    } else {
      if (!flows.some(f => f.id === b.fields.流程)) add(b.id, "所屬流程不存在");
      if (!/^\d{1,5}$/.test(b.fields.順序 || "") || Number(b.fields.順序) > 10000) add(b.id, "流程順序須為 0–10000 的整數");
      const flag = b.kind === "流程節點" ? "結束" : "循環";
      if (!["是", "否"].includes(b.fields[flag])) add(b.id, `${flag}須為是或否`);
      if (b.kind === "流程節點" && refs(b.fields.規則).some(id => !rules.has(id))) add(b.id, "流程引用的規則不存在於此版本");
    }
  }
  for (const flow of flows) {
    const {nodes, edges} = flowParts(doc, flow.id);
    const nodeIds = new Set(nodes.map(n => n.id));
    if (!nodes.length) add(flow.id, "流程至少需要一個節點");
    if (nodes.length > 200 || edges.length > 400) { add(flow.id, "單一流程最多 200 節點及 400 連線"); continue; }
    if (!nodeIds.has(flow.fields.起點)) add(flow.id, "流程起點不存在於此流程");
    if (new Set(nodes.map(n => Number(n.fields.順序))).size !== nodes.length) add(flow.id, "節點順序不可重複");
    for (const edge of edges) if (!nodeIds.has(edge.fields.起點) || !nodeIds.has(edge.fields.終點)) add(edge.id, "連線端點不存在於此流程");
    const validEdges = edges.filter(e => nodeIds.has(e.fields.起點) && nodeIds.has(e.fields.終點));
    function walk(starts: string[], reverse = false): Set<string> {
      const seen = new Set<string>(), queue = [...starts];
      while (queue.length) {
        const id = queue.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        for (const e of validEdges) if (e.fields[reverse ? "終點" : "起點"] === id) queue.push(e.fields[reverse ? "起點" : "終點"]);
      }
      return seen;
    }
    const reachable = walk([flow.fields.起點]);
    const endings = nodes.filter(n => n.fields.結束 === "是");
    if (!endings.length) add(flow.id, "流程須有結束節點");
    const canEnd = walk(endings.map(n => n.id), true);
    for (const node of nodes) {
      if (!reachable.has(node.id)) add(node.id, "節點無法從流程起點到達");
      if (!canEnd.has(node.id)) add(node.id, "節點沒有通往結束的路徑");
      const outgoing = validEdges.filter(e => e.fields.起點 === node.id);
      if (node.fields.結束 === "是" && outgoing.length) add(node.id, "結束節點不可有離開連線");
      if (outgoing.length > 1 && new Set(outgoing.map(e => e.fields.條件?.trim())).size !== outgoing.length) add(node.id, "分支條件不可重複");
    }
    // Removing explicitly labelled loop edges must leave an acyclic graph.
    const remaining = validEdges.filter(e => e.fields.循環 !== "是");
    const indegree = new Map(nodes.map(n => [n.id, remaining.filter(e => e.fields.終點 === n.id).length]));
    const queue = nodes.filter(n => indegree.get(n.id) === 0).map(n => n.id);
    let visited = 0;
    while (queue.length) {
      const id = queue.pop()!; visited++;
      for (const e of remaining.filter(e => e.fields.起點 === id)) {
        const degree = indegree.get(e.fields.終點)! - 1;
        indegree.set(e.fields.終點, degree);
        if (!degree) queue.push(e.fields.終點);
      }
    }
    if (visited !== nodes.length) add(flow.id, "循環連線須明確標記");
  }
  return issues;
}
