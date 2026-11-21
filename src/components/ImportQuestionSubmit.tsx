"use client";
import { useState } from "react";

export type BackgroundQuestion = { question: string; version: string; settings_version: string; confirmed_context: Record<string, string> };

export default function ImportQuestionSubmit({ base, question, disabled, onSubmitted }: { base: string; question: BackgroundQuestion; disabled: boolean; onSubmitted: () => void }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  async function submit() {
    if (busy) return;
    setBusy(true); setMessage(""); setError("");
    try {
      const payload = { ...question, confirmed_context: Object.fromEntries(Object.entries(question.confirmed_context).sort(([a], [b]) => a.localeCompare(b))) };
      const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([base, payload])));
      const key = "knowledge-question:" + Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, "0")).join("");
      // Store only an opaque ID, before sending. An uncertain response or reload
      // must reuse the same submission rather than dispatch another inference.
      let requestId = sessionStorage.getItem(key);
      if (!requestId) { requestId = crypto.randomUUID(); sessionStorage.setItem(key, requestId); }
      const response = await fetch(base + "/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, request_id: requestId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "背景問題提交失敗");
      setMessage("問題已保存，可離開此頁，稍後從背景問答紀錄查看。相同問題重送會取回原工作。");
      onSubmitted();
    } catch (e) { setError(e instanceof Error ? e.message : "背景問題提交失敗；重送會沿用相同請求"); }
    finally { setBusy(false); }
  }
  return <div className="my-3">
    <button className="btn-euro min-h-11 rounded-lg px-4 disabled:opacity-50" disabled={disabled || busy} onClick={() => void submit()}>{busy ? "正在保存問題…" : "提交背景問答（試用）"}</button>
    <p className="text-sm">需啟動本機背景問答服務；此流程尚在驗收中。</p>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}。可重送確認原工作，請勿另開分頁重複提交。</p>}
  </div>;
}
