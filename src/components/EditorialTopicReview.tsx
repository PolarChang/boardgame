"use client";
import { useState } from "react";
import { parseEditorial } from "@/lib/editorial";
import { topics, topicOf } from "@/lib/editorial-topics";
import { replaceEditorialBlock } from "@/lib/editorial-local";
import EditorialBlockCard from "./EditorialBlockCard";

export default function EditorialTopicReview({ text, onChange, onSelect }: { text: string; onChange: (text: string) => void | boolean; onSelect: (id: string) => void }) {
  const [notice, setNotice] = useState("");
  const [topic, setTopic] = useState(topics[0]);
  const [checkedText, setCheckedText] = useState("");
  const parsed = parseEditorial(text);
  const group = parsed.document.blocks.filter(b => ["規則", "FAQ"].includes(b.kind) && topicOf(b, parsed.document) === topic);
  const pending = group.filter(b => b.fields.狀態 !== "已確認");
  const blockers = parsed.issues.filter(i => group.some(b => b.id === i.id) && i.message !== "尚未人工確認，不可發布");
  const structural = parsed.issues.filter(i => !/尚未人工確認|未確認內容|章節尚未/.test(i.message) && !i.message.includes("規則 未確認"));
  const incomplete = parsed.document.blocks.filter(b => Object.values(b.fields).some(v => v.includes("未確認")));
  return <div className="my-4 space-y-5">
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-grid-line p-4"><h3 className="font-semibold">優先處理</h3><p className="text-sm">{structural.length} 項格式或引用問題</p><details><summary className="cursor-pointer text-sm text-brass">查看問題</summary><ul>{structural.map((i, n) => <li key={n} className="my-2 text-sm"><button className="text-left underline" onClick={() => onSelect(i.id)}>{i.id}：{i.message}</button></li>)}</ul></details></div>
    <div className="rounded-lg border border-grid-line p-4"><h3 className="font-semibold">需要補充</h3><p className="text-sm">{incomplete.length} 個條目仍有未確認欄位</p><details><summary className="cursor-pointer text-sm text-brass">查看待辦</summary><ul>{incomplete.map(b => <li key={b.id} className="my-2 text-sm"><button className="text-left underline" onClick={() => onSelect(b.id)}>{b.id}：{Object.entries(b.fields).filter(([, v]) => v.includes("未確認")).map(([k]) => k).join("、")}</button></li>)}</ul></details></div>
    <div className="rounded-lg border border-grid-line p-4"><h3 className="font-semibold">按主題核對</h3><p className="text-sm">先核對數字、條件與例外，再確認整組。自動檢查無法判斷譯文正確性。</p></div></div>
    <label className="block text-sm font-semibold">校對主題<select className="input-euro ml-3 min-h-11 max-w-full rounded-lg" value={topic} onChange={e => { setTopic(e.target.value); setCheckedText(""); }}>{topics.map(t => <option key={t}>{t}</option>)}</select></label>
    <p className="text-sm">本主題 {group.length} 筆 · 待確認 {pending.length} 筆。依標題自動分組，保留角色差異與原有引用；分類不代表內容已核實。</p>
    <div className="space-y-3">{group.map(b => <details key={b.id} className="rounded-lg border border-grid-line p-3"><summary className="cursor-pointer text-sm">{b.id} · {b.fields.標題 || b.fields.問題} · {b.fields.狀態}</summary><EditorialBlockCard block={b} /><button className="btn-euro mt-2 min-h-11 rounded-lg" onClick={() => onSelect(b.id)}>修改 {b.id}</button></details>)}</div>
    {blockers.length > 0 && <p className="text-sm text-amber-800">本組尚有 {blockers.length} 項待處理，請先補齊欄位與引用。整組確認不會把「未確認」自動改成「無」。</p>}
    <label className="flex gap-3 text-sm"><input type="checkbox" checked={checkedText === text + topic} onChange={e => setCheckedText(e.target.checked ? text + topic : "")} />我已對照來源，核對本主題全部條目的中文、數字、條件及例外。</label>
    <button className="btn-euro-primary min-h-11 rounded-lg px-4 disabled:opacity-50" disabled={!pending.length || !!blockers.length || checkedText !== text + topic} onClick={() => { let next = text; for (const b of pending) next = replaceEditorialBlock(next, b.id, { ...b.fields, 狀態: "已確認" }); const saved = onChange(next); setNotice(saved === false ? "儲存失敗：請下載備份，再重新儲存。" : `✓ 已確認並儲存「${topic}」${pending.length} 筆 · ${new Date().toLocaleTimeString("zh-TW")}（尚未發布）`); setCheckedText(""); }}>確認本主題 {pending.length} 筆（不發布）</button>
    {notice && <p role="status" className="rounded-lg border-2 border-brass bg-amber-50 p-4 font-semibold">{notice}</p>}
  </div>;
}
