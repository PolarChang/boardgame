"use client";
import type { EditorialDocument } from "@/lib/editorial";
import { flowParts, flowRuleIds, validateFlows } from "@/lib/editorial-flow";

export default function EditorialFlow({document, flowId, nodeId, onFlow, onNode, onRule}: {
  document: EditorialDocument; flowId: string; nodeId: string;
  onFlow: (id: string) => void; onNode: (id: string) => void; onRule: (id: string) => void;
}) {
  const flows = document.blocks.filter(b => b.kind === "流程");
  const flow = flows.find(b => b.id === flowId);
  const {nodes, edges} = flowParts(document, flowId);
  const issueIds = new Set([flowId, ...nodes.map(n => n.id), ...edges.map(e => e.id)]);
  const issues = validateFlows(document).filter(i => issueIds.has(i.id));
  return <section aria-label="遊戲流程" className="my-4 rounded-lg border border-grid-line p-4">
    <h3 className="font-semibold">按遊戲流程閱讀</h3>
    {!flows.length ? <p className="mt-3 text-sm leading-7">此版本尚未整理流程。下方仍列出全部符合搜尋的規則與 FAQ；可按主題或頁碼閱讀。</p> : <>
      <label className="my-3 block text-sm">選擇流程<select className="input-euro mt-2 min-h-11 w-full rounded-lg px-3" value={flowId} onChange={e => onFlow(e.target.value)}>{flows.map(f => <option key={f.id} value={f.id}>{f.fields.名稱 || f.id} · {f.fields.範圍 || "範圍待填"} · {f.fields.狀態 || "待確認"}</option>)}</select></label>
      <p className="text-sm leading-7">{flow?.fields.說明 || "依節點查找條文，分支條件請對照原規則；流程不會判定目前遊戲局面。"}</p>
      {!!issues.length && <details className="my-3 rounded-lg border border-amber-500 p-3"><summary className="min-h-11 cursor-pointer">流程待校對：{issues.length} 項</summary><ul className="list-inside list-disc text-sm">{issues.map((i, index) => <li key={index}>{i.id}：{i.message}</li>)}</ul></details>}
      <div className="my-3 flex flex-wrap gap-2"><button aria-pressed={!nodeId} className="btn-euro min-h-11 rounded-lg px-3" onClick={() => onNode("")}>全部步驟</button><button aria-pressed={nodeId === "unassigned"} className="btn-euro min-h-11 rounded-lg px-3" onClick={() => onNode("unassigned")}>其他／尚未編入此流程</button></div>
      <ol aria-label="流程步驟" className="grid gap-3 sm:grid-cols-2">
        {nodes.map((node, index) => <li key={node.id} className={`min-w-0 rounded-lg border p-3 ${nodeId === node.id ? "border-brass bg-brass/10" : "border-grid-line"}`}>
          <button aria-pressed={nodeId === node.id} className="min-h-11 text-left font-semibold" onClick={() => onNode(node.id)}>{index + 1}. {node.fields.標題 || node.id}{flow?.fields.起點 === node.id ? "（起點）" : ""}{node.fields.結束 === "是" ? "（結束）" : ""}</button>
          <p className="my-2 text-xs leading-6">{node.id} · {node.fields.狀態 || "待確認"} · {node.fields.角色 || "角色待填"} · {node.fields.人數 || "人數待填"} · {node.fields.擴充 || "擴充待填"}</p>
          {node.fields.說明 && <p className="my-2 whitespace-pre-wrap text-sm leading-7">{node.fields.說明}</p>}
          <div className="flex flex-wrap gap-2">{flowRuleIds(node).map(id => { const rule = document.blocks.find(b => b.kind === "規則" && b.id === id); return rule ? <button key={id} className="min-h-11 text-left text-sm underline" onClick={() => onRule(id)}>{id} · {rule.fields.標題}</button> : <span key={id} className="text-sm">{id}（引用待補）</span>; })}</div>
          <ul className="border-t border-grid-line pt-2 text-sm leading-7">{edges.filter(e => e.fields.起點 === node.id).map(e => <li key={e.id}>{e.fields.循環 === "是" ? "↩" : "→"} {e.fields.條件 || "條件待填"}：{nodes.find(n => n.id === e.fields.終點)?.fields.標題 || `${e.fields.終點}（節點待補）`}</li>)}</ul>
        </li>)}
      </ol>
      <p className="mt-3 text-xs leading-6">步驟依整理者指定順序顯示；搜尋結果仍套用角色、人數與其他篩選。未編入此流程的條目會保留在結果尾端。</p>
    </>}
  </section>;
}
