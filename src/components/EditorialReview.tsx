"use client";
import { useEffect, useRef, useState } from "react";
import EditorialVisualPreview from "./EditorialVisualPreview";
import EditorialSources from "./EditorialSources";
import EditorialTopicReview from "./EditorialTopicReview";
import { editorialFields, ids, parseEditorial, type EditorialBlock } from "@/lib/editorial";
import { replaceEditorialBlock } from "@/lib/editorial-local";

function status(block: EditorialBlock, issues: ReturnType<typeof parseEditorial>["issues"]) {
  if (issues.some(i => i.id === block.id && !/尚未人工確認|章節尚未/.test(i.message))) return "需補充";
  return ["已確認", "已整理", "不適用"].includes(block.fields.狀態) ? "已確認" : "待確認";
}
export default function EditorialReview({ text, onChange, onDirtyChange, gameId, password = "" }: { text: string; gameId?: string; password?: string; onChange: (text: string) => void | boolean; onDirtyChange?: (dirty: boolean) => void }) {
  const parsed = parseEditorial(text);
  const [query, setQuery] = useState(""), [selected, setSelected] = useState(""), [notice, setNotice] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<(() => void) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const bypass = useRef(false);
  const block = parsed.document.blocks.find(b => b.id === selected);
  const dirty = !!block && JSON.stringify(fields) !== JSON.stringify(block.fields);
  const blocks = parsed.document.blocks.filter(b => (!statusFilter || status(b, parsed.issues) === statusFilter) && `${b.id} ${Object.values(b.fields).join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("block");
    const initial = parseEditorial(text).document.blocks.find(b => b.id === id);
    if (initial) { setSelected(initial.id); setFields(initial.fields); }
    // Restore only on mount; subsequent text changes must not discard unsaved fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (pending) dialog.current?.showModal(); else dialog.current?.close(); }, [pending]);
  useEffect(() => {
    if (!dirty) return;
    const leave = (event: BeforeUnloadEvent) => { if (!bypass.current) { event.preventDefault(); event.returnValue = ""; } };
    const click = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (link && link.target !== "_blank" && !link.hasAttribute("download")) { event.preventDefault(); event.stopPropagation(); setPending(() => () => { bypass.current = true; window.location.assign(link.href); }); }
    };
    window.addEventListener("beforeunload", leave); document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", leave); document.removeEventListener("click", click, true); };
  }, [dirty]);
  function select(id: string) {
    const action = () => { const next = parsed.document.blocks.find(b => b.id === id); setSelected(id); setFields(next?.fields || {}); setNotice(""); const url = new URL(window.location.href); if (id) url.searchParams.set("block", id); else url.searchParams.delete("block"); window.history.replaceState(null, "", url); };
    if (dirty) setPending(() => action); else action();
  }
  function save() {
    if (!block) return false;
    const next = replaceEditorialBlock(text, block.id, fields);
    if (onChange(next) === false) { setNotice("儲存失敗：修改仍保留在編輯欄位，請重試或複製備份。"); return false; }
    const remaining = parseEditorial(next).issues.filter(i => i.id === block.id).length;
    setNotice(`✓ ${block.id} 已儲存 · ${new Date().toLocaleTimeString("zh-TW")} · ${remaining ? `仍有 ${remaining} 項待辦，尚未完成確認` : `目前狀態：${fields.狀態 || "不適用"}（尚未發布）`}`);
    return true;
  }
  const groups = [
    { title: "內容與步驟", keys: [...new Set([...(editorialFields[block?.kind || ""] || []), ...Object.keys(fields)])].filter(k => !["條件", "成本", "結果", "限制", "例外", "來源", "PDF頁碼", "原文", "相關規則", "引用", "狀態"].includes(k)) },
    { title: "條件、成本與例外", keys: ["條件", "成本", "結果", "限制", "例外"] },
    { title: "來源與關聯", keys: ["來源", "PDF頁碼", "原文", "相關規則", "引用", "狀態"] },
  ];
  return <section className="card-euro my-6 rounded-lg p-4 sm:p-5" aria-label="逐條校對">
    <h2 className="text-xl font-semibold">主題校對與待辦</h2>
    <details className="my-4 rounded-lg border border-grid-line p-3"><summary className="min-h-11 cursor-pointer">展開主題與待辦總覽</summary><fieldset disabled={dirty}><EditorialTopicReview text={text} onChange={onChange} onSelect={id => { select(id); setStatusFilter(""); setQuery(""); }} /></fieldset>{dirty && <p>請先儲存目前條目，再操作主題校對。</p>}</details>
    <h3 id="individual-review" className="scroll-mt-8 text-lg font-semibold">修改個別條目</h3>
    <label className="my-3 block text-sm">尋找校對條目<input className="input-euro my-2 block min-h-11 w-full rounded-lg px-3" value={query} onChange={e => setQuery(e.target.value)} /></label>
    <div className="my-3 flex flex-wrap gap-2" aria-label="校對狀態篩選">{["", "需補充", "待確認", "已確認"].map(v => <button key={v} aria-pressed={statusFilter === v} onClick={() => setStatusFilter(v)} className="btn-euro min-h-11 rounded-lg px-3">{v || "全部狀態"} · {parsed.document.blocks.filter(b => !v || status(b, parsed.issues) === v).length}</button>)}</div>
    <label className="block text-sm">選擇校對條目<select className="input-euro my-2 block min-h-11 w-full rounded-lg px-3" value={selected} onChange={e => select(e.target.value)}><option value="">請選擇（{blocks.length} 筆）</option>{block && !blocks.some(b => b.id === selected) && <option value={selected}>{selected}（目前編輯，不符合篩選）</option>}{blocks.map(b => <option key={b.id} value={b.id}>{status(b, parsed.issues)} · {b.id} · {b.fields.標題 || b.fields.問題 || b.fields.章節 || b.fields.名稱 || b.fields.中文 || b.kind}</option>)}</select></label>
    {block && <><div className="my-3 flex flex-wrap gap-2">{[{ label: "上一條", next: blocks[blocks.findIndex(b => b.id === selected) - 1] }, { label: "下一條", next: blocks[blocks.findIndex(b => b.id === selected) + 1] }, { label: "下一個待辦", next: [...blocks.slice(blocks.findIndex(b => b.id === selected) + 1), ...blocks.slice(0, blocks.findIndex(b => b.id === selected))].find(b => status(b, parsed.issues) !== "已確認") }].map(item => <button className="btn-euro min-h-11 rounded-lg" key={item.label} disabled={!item.next} onClick={() => item.next && select(item.next.id)}>{item.label}</button>)}</div>
      <p role="status" className="knowledge-panel sticky top-24 z-10 rounded-lg border p-3 font-semibold">{block.id} · {dirty ? "● 有尚未儲存的修改" : "目前顯示已儲存內容"}</p>
      {notice && <p role="status" className="my-3 rounded-lg border border-brass p-4">{notice}</p>}
      <ul className="my-3 text-sm text-ink-light">{parsed.issues.filter(i => i.id === selected).map((issue, index) => <li key={index}>{issue.message}</li>)}</ul>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"><div className="min-w-0">{groups.map(group => <fieldset key={group.title} className="my-4 space-y-3 rounded-lg border border-grid-line p-3"><legend className="px-2 font-semibold">{group.title}</legend>{group.keys.filter(k => k in fields || editorialFields[block.kind]?.includes(k)).map(key => <label key={key} className="block text-sm font-semibold">{key}{key === "狀態" ? <select aria-label={key} className="input-euro my-2 block min-h-11 w-full rounded-lg" value={fields[key] || ""} onChange={e => setFields({ ...fields, [key]: e.target.value })}>{[...new Set([fields[key] || "待確認", "待確認", ...(block.kind === "涵蓋" ? ["已整理", "不適用"] : ["已確認"])])].map(v => <option key={v}>{v}</option>)}</select> : <textarea aria-label={key} className="input-euro mt-2 block w-full rounded-lg p-3 text-base leading-7" rows={["內容", "答案", "原文"].includes(key) ? 5 : 2} value={fields[key] || ""} onChange={e => setFields({ ...fields, [key]: e.target.value, ...(editorialFields[block.kind]?.includes("狀態") ? { 狀態: "待確認" } : {}) })} />}</label>)}</fieldset>)}</div>
      <aside className="knowledge-panel min-w-0 rounded-lg border p-4 xl:sticky xl:top-28"><h4 className="font-semibold">來源對照</h4>{block.kind === "圖片" && gameId && <EditorialVisualPreview gameId={gameId} password={password} asset={block.fields.資產 || ""} />}<EditorialSources key={block.fields.來源} document={parsed.document} block={block} /><p className="my-3 text-sm">{block.fields.來源 || "尚未提供來源"} · PDF {block.fields.PDF頁碼 || "未提供頁碼"}</p>{parsed.document.blocks.filter(b => b.kind === "來源" && ids(block.fields.來源).includes(b.id)).map(source => /^https?:\/\//.test(source.fields.網址 || "") ? <a key={source.id} href={source.fields.網址} target="_blank" rel="noreferrer" className="my-3 block underline">開啟 {source.fields.名稱 || source.id} ↗</a> : <p key={source.id}>此來源尚未提供可開啟的網址。</p>)}<p className="whitespace-pre-wrap break-words text-sm leading-7">{block.fields.原文 || "尚無原文摘錄，請對照來源補充。"}</p></aside></div>
      <div className="knowledge-panel sticky bottom-0 z-10 border-t p-3"><button className="btn-euro-primary min-h-11 rounded-lg px-4" onClick={save}>儲存此條校對</button><p className="mt-2 text-xs">修改會恢復待確認；儲存不會發布。請在對照原文後才確認狀態。</p></div>
    </>}
    <dialog ref={dialog} className="knowledge-panel max-w-md rounded-lg border p-6 backdrop:bg-black/50" aria-label="尚未儲存的修改" onCancel={() => setPending(null)}><h3 className="font-semibold">尚未儲存的修改</h3><p className="my-3">離開前，請決定如何處理目前條目的修改。</p><div className="flex flex-wrap gap-3"><button autoFocus className="btn-euro min-h-11 rounded-lg" onClick={() => setPending(null)}>繼續編輯</button><button className="btn-euro min-h-11 rounded-lg" onClick={() => { setFields(block?.fields || {}); pending?.(); setPending(null); }}>放棄修改並離開</button><button className="btn-euro-primary min-h-11 rounded-lg" onClick={() => { if (save()) { pending?.(); setPending(null); } }}>儲存並繼續</button></div></dialog>
  </section>;
}
