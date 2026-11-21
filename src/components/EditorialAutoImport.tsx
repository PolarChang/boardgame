"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import EditorialImportSource from "./EditorialImportSource";

type Job = { id: string; filename: string; total: number; completed_pages: number[]; status: string; error: string; resume_at?: number; lifecycle?: { stage: string; searchable: boolean; readable_pages: number; total_pages: number; wait_reason: string | null; content_verified: boolean }; source_task?: { state: string; retry_at: number; attempts: number; error: string }; unresolved_blocks?: number; warning_pages?: number; pending_retry_blocks?: number };
const phases: Record<string, string> = { queued: "等待擷取", extracting: "擷取中", searchable: "來源已可查詢", enriching: "來源已可查詢・補強中", ready: "流程完成", ready_with_gaps: "流程完成・仍有缺漏", failed: "來源處理失敗" };
const waits: Record<string, string> = { source_retry: "等待來源提取重試", local_service: "等待本機模型服務", paused: "模型整理已暫停", worker_queue: "模型整理等待工作程式", repair_queue: "等待來源補強工作", budget: "等待本機分類預算" };
const labels: Record<string, string> = { queued: "等待本機電腦處理", processing: "本機處理中", paused: "已暫停", review: "機器處理完成・待校對" };

export default function EditorialAutoImport({ gameId, password, sessionActive = false, disabled, embedded = false, onPreview }: { gameId: string; password: string; sessionActive?: boolean; disabled: boolean; embedded?: boolean; onPreview: (text: string) => void }) {
  const [jobs, setJobs] = useState<Job[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const initialLoad = useRef<AbortController | null>(null);
  const [owner, setOwner] = useState("");
  const identity = gameId + password;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const base = `/api/rules/knowledge/games/${encodeURIComponent(gameId)}/editorial/imports`;
  const visible = useMemo(() => owner === gameId + password && (password || sessionActive) ? jobs : [], [owner, gameId, password, sessionActive, jobs]);
  async function request(path = "", form?: FormData, post = false) {
    const response = await fetch(base + path, { method: form || post ? "POST" : "GET", cache: "no-store", headers: { "X-Knowledge-Admin": password }, ...(form ? { body: form } : post ? { body: "{}" } : {}) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "匯入服務暫時無法使用");
    return result;
  }
  async function refresh() { initialLoad.current?.abort(); const result = await request(); setJobs(result.jobs); setOwner(gameId + password); }
  useEffect(() => {
    if (!sessionActive) return;
    const controller = new AbortController();
    initialLoad.current = controller;
    fetch(base, { cache: "no-store", signal: controller.signal, headers: { "X-Knowledge-Admin": password } })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "無法讀取匯入任務");
        if (!controller.signal.aborted) {
          setJobs(data.jobs || []);
          setOwner(identity);
        }
      })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [base, identity, password, sessionActive]);
  useEffect(() => {
    if ((!password && !sessionActive) || !visible.some(job => job.lifecycle ? !["ready", "ready_with_gaps", "failed"].includes(job.lifecycle.stage) : ["queued", "processing"].includes(job.status) || ["queued", "extracting", "waiting_retry"].includes(job.source_task?.state || ""))) return;
    let active = true;
    const timer = setInterval(() => {
      fetch(base, { cache: "no-store", headers: { "X-Knowledge-Admin": password } }).then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "無法更新匯入進度");
        if (active) { setJobs(data.jobs); setOwner(gameId + password); }
      }).catch(e => { if (active) setError(e.message); });
    }, 8000);
    return () => { active = false; clearInterval(timer); };
  }, [base, gameId, password, sessionActive, visible]);
  async function run(action: () => Promise<void>) { setBusy(true); setError(""); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "匯入失敗"); } finally { setBusy(false); } }
  return <section className={embedded ? "space-y-2" : "card-euro my-5 rounded-lg p-5"} aria-label="PDF 自動整理">
    {!embedded && <h2 className="text-xl font-semibold">PDF／圖片自動整理</h2>}
    <label className="block text-sm">選擇規則書或圖片<input className="my-3 block w-full" type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={(!password && !sessionActive) || busy || disabled} onChange={e => {
      const file = e.target.files?.[0]; e.target.value = "";
      if (!file) return;
      if (file.size > 50_000_000) { setError("檔案不可超過 50 MB"); return; }
      void run(async () => {
        const form = new FormData();
        if (file.size > 4_000_000) {
          const signed = await fetch(base.replace(/\/imports$/, "/visuals/upload-url"), { method: "POST", headers: { "Content-Type": "application/json", "X-Knowledge-Admin": password }, body: JSON.stringify({ content_type: file.type || "application/pdf", size: file.size }) });
          if (signed.ok) {
            const upload = await signed.json();
            const sent = await fetch(upload.upload_url, { method: "PUT", headers: { "Content-Type": file.type || "application/pdf" }, body: file });
            if (!sent.ok) throw new Error("檔案直傳失敗，請重新上傳");
            form.append("object_name", upload.object_name); form.append("filename", file.name);
          } else if (signed.status === 503) { form.append("file", file); }
          else { const failure = await signed.json(); throw new Error(failure.error || "無法取得直傳位置"); }
        } else { form.append("file", file); }
        await request("", form); await refresh();
      });
    }} /></label>
    <p className="text-xs text-ink-light">PDF、PNG、JPEG · 上限 50 MB</p>
    <details className="text-sm text-ink-light"><summary className="inline-flex min-h-11 cursor-pointer items-center underline">格式與處理提示</summary><p>PDF 最多 100 頁。本機服務離線時，任務會等待處理。</p></details>
    {(!password && !sessionActive) && <p className="mb-3 text-sm">登入後可匯入。</p>}
    <button className="btn-euro min-h-11 rounded-lg px-4 disabled:opacity-50" disabled={(!password && !sessionActive) || busy} onClick={() => void run(refresh)}>{busy ? "處理中…" : "重新整理匯入任務"}</button>
    {error && <p role="alert" className="my-3 text-red-700">{error}</p>}
    <ul className="mt-4 space-y-4">{visible.map(job => <li key={job.id} className="rounded-lg border border-grid-line p-4 text-sm">
      <p className="break-all font-semibold">{job.filename}</p><p className="my-2" role="status">{labels[job.status] || job.status} · {job.completed_pages.length}／{job.total} 頁</p>
      {job.lifecycle && <p role="status" className="my-2">可讀 {job.lifecycle.readable_pages}／{job.lifecycle.total_pages} 頁</p>}
      <progress className="w-full" max={job.total} value={job.completed_pages.length} aria-label={`${job.filename} 處理進度`} />
      {job.source_task?.state === "failed" && <p role="alert" className="my-2 text-red-700">PDF 無法解析，請檢查檔案後重新匯入。</p>}
      {job.error && <p className="my-2 text-red-700">{job.error}</p>}
      <details className="text-ink-light"><summary className="min-h-11 cursor-pointer py-3">處理明細</summary>
      {job.lifecycle && <p className="my-2">{phases[job.lifecycle.stage] || job.lifecycle.stage}{job.lifecycle.wait_reason && ` · ${waits[job.lifecycle.wait_reason] || job.lifecycle.wait_reason}`}</p>}
      {job.source_task?.state === "waiting_retry" && <p role="status" className="my-2">原文提取暫時失敗，預計 {new Date(job.source_task.retry_at * 1000).toLocaleString("zh-TW")} 自動重試；已完成來源仍可閱讀。</p>}
      {job.source_task?.state === "extracting" && <p role="status" className="my-2">正在提取原文，完成的頁面會先提供閱讀。</p>}
      {Boolean(job.unresolved_blocks || job.warning_pages) && <p className="my-2 text-amber-800">{job.unresolved_blocks || 0} 個區塊尚未取得可靠結果；{job.warning_pages || 0} 頁含校對提醒。請下載來源核對。</p>}
      {Boolean(job.pending_retry_blocks) && <p className="my-2">尚有 {job.pending_retry_blocks} 個區塊等待重試；原結果已保存。</p>}
      {!!job.resume_at && <p role="status">預計 {new Date(job.resume_at * 1000).toLocaleString("zh-TW")} 自動恢復排程；已完成來源仍可閱讀。</p>}
      <p className="my-2">機器處理完成後，仍需核對內容。</p></details>
      <div className="mt-3 flex flex-wrap gap-3">
        <a className="btn-euro-primary inline-flex min-h-11 items-center rounded-lg px-3" href={`/knowledge/${encodeURIComponent(gameId)}/imports/${job.id}`}>閱讀與查詢匯入內容</a>
        <button className="btn-euro min-h-11 rounded-lg px-3" disabled={busy} onClick={() => void run(async () => {
          const response = await fetch(`${base}/${job.id}/source`, { cache: "no-store", headers: { "X-Knowledge-Admin": password } });
          if (!response.ok) throw new Error("無法下載來源，請確認管理密碼與連線");
          const url = URL.createObjectURL(await response.blob());
          const link = document.createElement("a"); link.href = url; link.download = "rules-source.pdf"; link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        })}>下載來源 PDF 核對</button>
        {job.status === "review" && Boolean(job.unresolved_blocks) && <button className="btn-euro min-h-11 rounded-lg px-3" disabled={busy || disabled} onClick={() => void run(async () => { await request(`/${job.id}/retry`, undefined, true); await refresh(); })}>只重試待辨識區塊</button>}
        {job.status === "paused" && <button className="btn-euro min-h-11 rounded-lg px-3" disabled={busy} onClick={() => void run(async () => { await request(`/${job.id}/resume`, undefined, true); await refresh(); })}>從完成頁面續跑</button>}
        {job.completed_pages.length > 0 && <button className="btn-euro min-h-11 rounded-lg px-3" disabled={busy || disabled} onClick={() => void run(async () => { const draft = await request(`/${job.id}/draft`); if (currentIdentity.current === identity) onPreview(draft.text); })}>預覽待校對稿</button>}
      </div>
      <EditorialImportSource key={identity + job.id} base={base} password={password} job={job} jobs={visible} />
    </li>)}</ul>
  </section>;
}
