"use client";
import { useEffect, useState } from "react";

export type SavedQuestion = {
  id: string;
  status: "queued" | "running" | "cancelling" | "completed" | "failed" | "timed_out" | "cancelled";
  created_at: number;
  question: { question: string; version: string; settings_version: string; confirmed_context: Record<string, string> };
  result: unknown;
  error: string;
};
const labels = { queued: "排隊中", running: "執行中", cancelling: "正在取消", completed: "已完成", failed: "執行失敗", timed_out: "已逾時", cancelled: "已取消" };

export default function ImportQuestionHistory({ base, onOpen, mode = "questions", revision = 0 }: { base: string; onOpen: (job: SavedQuestion) => Promise<void>; mode?: "questions" | "answers"; revision?: number }) {
  const [jobs, setJobs] = useState<SavedQuestion[]>([]);
  const [offset, setOffset] = useState(0), [refresh, setRefresh] = useState(0);
  const [error, setError] = useState(""), [loading, setLoading] = useState(true), [opening, setOpening] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const response = await fetch(`${base}/${mode}?offset=${offset}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "無法讀取問答紀錄");
        if (controller.signal.aborted) return;
        setJobs(data.jobs); setError(""); setLoading(false);
        if (data.jobs.some((job: SavedQuestion) => ["queued", "running", "cancelling"].includes(job.status))) timer = setTimeout(() => void load(), 5000);
      } catch (e) {
        if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : "無法讀取問答紀錄"); setLoading(false); }
      }
    }
    setLoading(true); setJobs([]);
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [base, offset, refresh, mode, revision]);
  async function open(job: SavedQuestion) {
    setOpening(job.id); setError("");
    try { await onOpen(job); }
    catch (e) { setError(e instanceof Error ? e.message : "無法開啟歷史回答"); }
    finally { setOpening(""); }
  }
  async function cancel(job: SavedQuestion) {
    try {
      const response = await fetch(`${base}/questions/${job.id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "無法取消工作");
      setRefresh(value => value + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "無法取消工作"); }
  }
  return <section className="card-euro my-5 rounded-lg p-5" aria-label={mode === "answers" ? "已保存答案" : "背景問答紀錄"}>
    <h2 className="text-xl font-semibold">{mode === "answers" ? "已保存答案" : "背景問答紀錄"}</h2>
    <p className="my-2 text-sm">{mode === "answers" ? "一般試問與背景問答產生的答案都保留在此，可開啟當時來源並回報問題。" : "已提交的背景問題會保留在此，離頁後可回來查看。執行時間取決於本機工作程式與排隊狀況。"}</p>
    <button className="btn-euro min-h-11 rounded-lg px-3" disabled={loading} onClick={() => setRefresh(value => value + 1)}>更新問答紀錄</button>
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">正在讀取問答紀錄…</p> : !error && !jobs.length && <p>{mode === "answers" ? "此文件尚無已保存答案。" : "此頁尚無背景問答紀錄。"}</p>}
    <ul>{jobs.map(job => <li key={job.id} className="my-3 rounded-lg border border-grid-line p-3">
      <p className="font-semibold">{job.question.question}</p>
      <p role="status">{labels[job.status]} · {new Date(job.created_at * 1000).toLocaleString("zh-TW")}</p>
      <p className="text-sm">來源版本 {job.question.version.slice(0, 12)}</p>
      {job.status === "failed" && <p>工作未能完成；已取得的部分結果仍可查看。</p>}
      {job.status === "timed_out" && <p>工作超過期限，未接受逾時結果。</p>}
      {job.error === "python_execution_stopped" && <p>問答程序已停止；已派送的模型用量可能仍未知。</p>}
      {job.result !== null && <button className="btn-euro min-h-11 rounded-lg px-3" disabled={Boolean(opening)} onClick={() => void open(job)}>{opening === job.id ? "讀取原版本…" : "查看保存的回答"}</button>}
      {["queued", "running"].includes(job.status) && <button className="btn-euro min-h-11 rounded-lg px-3" onClick={() => void cancel(job)}>{job.status === "queued" ? "取消排隊" : "取消問答"}</button>}
    </li>)}</ul>
    <div className="mt-3 flex gap-3">
      <button className="btn-euro min-h-11 rounded-lg px-3" disabled={loading || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 50))}>較新的紀錄</button>
      <button className="btn-euro min-h-11 rounded-lg px-3" disabled={loading || jobs.length < 50} onClick={() => setOffset(value => value + 50)}>較舊的紀錄</button>
    </div>
  </section>;
}
