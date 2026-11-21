"use client";
import { useEffect, useState } from "react";
import ImportFeedbackHistory, { feedbackLabels } from "./ImportFeedbackHistory";
type Report = { version: string; findings: { id: string; page: string; message: string; code: string }[]; candidates: { id: string; block_id: string; version: string; state: string; result: string }[] };
function candidateText(value: string) { try { const result = JSON.parse(value); return result.candidate?.translation || result.message || "尚無辨識結果"; } catch { return "尚無辨識結果"; } }
export default function ImportQuality({ base, version, answerId }: { base: string; version: string; answerId?: string }) {
  const [report, setReport] = useState<Report | null>(null), [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  const [kind, setKind] = useState("missing_condition"), [comment, setComment] = useState("");
  useEffect(() => { let active = true; setReport(null); fetch(base + "/quality", { cache: "no-store" }).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); if (active) setReport(data); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [base, version]);
  useEffect(() => { setNotice(""); setComment(""); }, [answerId]);
  async function run(action: "repair" | "feedback" | "quality") {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(base + "/" + action, action === "quality" ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "repair" ? { version } : { answer_id: answerId, kind, comment }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "操作失敗");
      if (action === "quality") setReport(data); else setNotice(data.message);
    } catch (e) { setError(e instanceof Error ? e.message : "操作失敗"); } finally { setBusy(false); }
  }
  return <section className="card-euro my-5 rounded-lg p-5" aria-label="自動檢查與回饋">
    <h2 className="text-xl font-semibold">自動檢查與局部補辨識</h2>
    <p className="my-3 text-sm leading-7">先標記疑似缺漏，再由本機模型補辨識。沒有標記不代表內容完全正確；候選修訂保留來源，尚不直接覆寫規則。</p>
    {report && <><p>發現 {report.findings.length} 項疑點。</p><details className="my-3"><summary className="min-h-11 cursor-pointer">查看缺漏位置</summary>{report.findings.map(item => <p key={item.id + item.code} className="my-2">第 {item.page} 頁 · {item.id}：{item.message}</p>)}</details>
      <button disabled={busy || report.version !== version || !report.findings.length} className="btn-euro min-h-11 rounded-lg px-4" onClick={() => void run("repair")}>補辨識疑似缺漏（最多兩頁）</button>
      {report.candidates.map(item => <details key={item.id} className="my-3"><summary className="min-h-11 cursor-pointer">{item.block_id} · {({ queued: "等待本機處理", processing: "本機補辨識中", candidate: "已產生候選，待驗證", rejected: "候選內容不足，未套用", failed: "未完成，已保留原稿" } as Record<string, string>)[item.state] || item.state}{item.version !== version && " · 舊版本"}</summary><pre className="whitespace-pre-wrap text-sm">{candidateText(item.result)}</pre></details>)}</>}
    <button disabled={busy} className="btn-euro ml-3 min-h-11 rounded-lg px-4" onClick={() => void run("quality")}>更新檢查進度</button>
    {answerId && <div className="mt-5 border-t border-grid-line pt-4"><h3 className="font-semibold">回報這次回答</h3><label className="my-3 block">問題類型<select className="input-euro ml-3 min-h-11" value={kind} onChange={e => setKind(e.target.value)}>{Object.entries(feedbackLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>補充說明<textarea maxLength={2000} className="input-euro my-2 block min-h-24 w-full p-3" value={comment} onChange={e => setComment(e.target.value)} /></label><button disabled={busy} className="btn-euro min-h-11 rounded-lg px-4" onClick={() => void run("feedback")}>送出回饋</button><p className="my-2 text-sm">會記錄這次問題、答案版本及來源。回饋只保存為待查證案例，不會自動執行模型修復。</p></div>}
    <ImportFeedbackHistory base={base} />
    {notice && <p role="status" className="my-3">{notice}</p>}{error && <p role="alert" className="my-3 text-red-800">{error}</p>}
  </section>;
}
