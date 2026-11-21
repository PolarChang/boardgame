"use client";
import { useRef, useEffect, useState } from "react";

export const feedbackLabels: Record<string, string> = { wrong_answer: "答錯", missing_condition: "漏答或缺少條件", wrong_number: "數字錯誤", wrong_source: "引用不符", unclear: "看不懂", other: "其他問題" };
type Entry = { id: string; kind: string; comment: string; version: string; record: { question: string; answer: { answer: string; model?: string; answer_engine?: string }; blocks: { id: string; fields: Record<string, string> }[] } };

export default function ImportFeedbackHistory({ base }: { base: string }) {
  const [items, setItems] = useState<Entry[] | null>(null), [next, setNext] = useState<number | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(() => { const lifecycle = generation; lifecycle.current++; setItems(null); setNext(null); setBusy(false); setError(""); return () => { lifecycle.current++; }; }, [base]);
  async function read(offset = 0) {
    const request = ++generation.current;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${base}/feedback?offset=${offset}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "無法讀取回饋紀錄");
      if (!Array.isArray(data.items)) throw new Error("回饋紀錄格式不正確");
      if (request === generation.current) { setItems(previous => offset ? [...(previous || []), ...data.items] : data.items); setNext(data.next_offset); }
    } catch (e) { if (request === generation.current) setError(e instanceof Error ? e.message : "無法讀取回饋紀錄"); }
    finally { if (request === generation.current) setBusy(false); }
  }
  return <section className="my-5 border-t border-grid-line pt-4" aria-label="已保存回饋">
    <h3 className="font-semibold">此文件的回饋紀錄</h3>
    <button disabled={busy} className="btn-euro my-2 min-h-11 rounded-lg px-4" onClick={() => void read()}>讀取／更新回饋紀錄</button>
    {busy && <p role="status">正在讀取回饋…</p>}{error && <p role="alert">{error}</p>}
    {items?.length === 0 && <p>尚無回饋紀錄。</p>}
    {items?.map(item => <details key={item.id} className="my-3"><summary className="min-h-11 cursor-pointer">{feedbackLabels[item.kind] || item.kind}：{item.record.question}</summary>
      <p className="my-2 whitespace-pre-wrap">補充：{item.comment || "未填寫"}</p>
      <p className="whitespace-pre-wrap">當時回答：{item.record.answer.answer}</p>
      <p className="my-2 text-sm">來源版本：{item.version.slice(0, 12)} · {item.record.answer.model || "未記錄模型"} · {item.record.answer.answer_engine || "未記錄流程版本"}</p>
      <a className="text-brass underline" href={`?version=${encodeURIComponent(item.version)}`}>開啟當時來源版本</a>
      {item.record.blocks.map(block => <blockquote key={block.id} className="my-3 border-l-2 pl-3"><p className="text-sm">{block.id} · 第 {block.fields.PDF頁碼} 頁</p><p className="whitespace-pre-wrap">{block.fields.原文 || block.fields.內容}</p></blockquote>)}
    </details>)}
    {next !== null && <button disabled={busy} className="btn-euro min-h-11 rounded-lg px-4" onClick={() => void read(next)}>載入更多回饋</button>}
  </section>;
}
