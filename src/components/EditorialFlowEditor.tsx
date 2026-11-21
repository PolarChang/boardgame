"use client";
import { useState } from "react";
import { parseEditorial, type EditorialBlock } from "@/lib/editorial";

export default function EditorialFlowEditor({text, disabled, onAppend}: {text:string; disabled:boolean; onAppend:(blocks:EditorialBlock[]) => boolean}) {
  const [name, setName] = useState(""), [scope, setScope] = useState("總覽"), [start, setStart] = useState(""), [end, setEnd] = useState("");
  const [notice, setNotice] = useState("");
  const rules = parseEditorial(text).document.blocks.filter(b => b.kind === "規則");
  function create() {
    if (!name.trim() || !rules.some(r => r.id === start) || !rules.some(r => r.id === end)) return;
    const id = `FLOW-${crypto.randomUUID().slice(0, 8)}`;
    const shared = {流程:id,角色:"全部",人數:"全部",擴充:"全部",狀態:"待確認"};
    const blocks: EditorialBlock[] = [
      {kind:"流程",id,fields:{名稱:name.trim(),範圍:scope,起點:`${id}-START`,說明:"請依原規則核對步驟、分支與結束條件。",狀態:"待確認"}},
      {kind:"流程節點",id:`${id}-START`,fields:{...shared,標題:"開始步驟",順序:"1",規則:start,結束:"否"}},
      {kind:"流程節點",id:`${id}-END`,fields:{...shared,標題:"結束步驟",順序:"2",規則:end,結束:"是"}},
      {kind:"流程連線",id:`${id}-EDGE`,fields:{流程:id,起點:`${id}-START`,終點:`${id}-END`,條件:"未確認",順序:"1",循環:"否",狀態:"待確認"}},
    ];
    if (onAppend(blocks)) { setNotice(`已加入 ${id}，所有流程段落保持待確認。請在逐條校對選擇這些編號，修改節點與連線。`); setName(""); }
    else setNotice("流程尚未加入，請先處理保存問題。");
  }
  return <details className="my-4 rounded-lg border border-grid-line p-4"><summary className="min-h-11 cursor-pointer font-semibold">建立流程草稿</summary>
    <p className="my-3 text-sm leading-7">先建立起點與結束節點，再至逐條校對調整標題、規則引用、條件及連線；新增更多節點可使用匯入範本。建立不代表流程已核對。</p>
    <a className="my-2 inline-flex min-h-11 items-center text-sm underline" href="/templates/rules-editorial-flow-v2.md" download>下載流程段落範本（合併至現有稿件，勿單獨替換）</a>
    {!rules.length ? <p className="text-sm">請先匯入規則，再建立流程。</p> : <fieldset disabled={disabled} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">流程名稱<input maxLength={100} className="input-euro mt-2 min-h-11 w-full rounded-lg px-3" value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="text-sm">流程範圍<select className="input-euro mt-2 min-h-11 w-full rounded-lg px-3" value={scope} onChange={e => setScope(e.target.value)}><option>總覽</option><option>回合</option></select></label>
      {[{label:"起點引用規則",value:start,set:setStart},{label:"結束引用規則",value:end,set:setEnd}].map(item => <label key={item.label} className="text-sm">{item.label}<select className="input-euro mt-2 min-h-11 w-full rounded-lg px-3" value={item.value} onChange={e => item.set(e.target.value)}><option value="">請選擇規則</option>{rules.map(r => <option key={r.id} value={r.id}>{r.id} · {r.fields.標題}</option>)}</select></label>)}
      <button disabled={!name.trim() || !start || !end} className="btn-euro min-h-11 rounded-lg px-4" onClick={create}>加入待校對流程</button>
    </fieldset>}
    {notice && <p role="status" className="mt-3 text-sm leading-7">{notice}</p>}
  </details>;
}
