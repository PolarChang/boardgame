"use client";
import { useState } from "react";

const labels = { input_tokens: "輸入", output_tokens: "輸出", thinking_tokens: "思考", cached_tokens: "快取輸入", total_tokens: "總計" };
type Counts = Record<keyof typeof labels, number>;
type LocalCounts = { model: string; requests: number; input_tokens: number; output_tokens: number; unknown_requests: number; duration_seconds?: number; unknown_duration_requests?: number };
const stages: Record<string, string> = { "embedding-source": "來源索引", "embedding-query": "問題索引", "retrieval-rewrite": "問題翻譯與規劃", "retrieval-rerank": "證據排序", "qa-claims": "產生回答", "qa-verify": "核對回答", healthcheck: "服務推論檢查" };
type Usage = { local_usage?: { cache_hits?: { document_id: string | null; model: string; operation: string; events: number; items: number }[]; models: LocalCounts[]; documents?: (LocalCounts & { document_id: string | null; operation: string; failed_requests: number; retry_requests: number; unknown_outcome_requests: number; unknown_attempt_requests: number })[]; operations?: (LocalCounts & { operation: string })[] }; configured: boolean; model: string; free_tier_confirmed: boolean; requests: number; totals: Counts; unknown: Counts; recent: { id: string; model: string; operation: string; created_at: string; status: string; usage: Partial<Counts> }[] };

export default function GeminiUsage({ gameId, password, sessionActive = false }: { gameId: string; password: string; sessionActive?: boolean }) {
  const [result, setResult] = useState<{ gameId: string; password: string; data: Usage } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const data = result?.gameId === gameId && result.password === password && (password || sessionActive) ? result.data : null;
  async function refresh() {
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch(`/api/rules/knowledge/games/${encodeURIComponent(gameId)}/editorial/gemini-usage`, { cache: "no-store", headers: { "X-Knowledge-Admin": password } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "無法取得用量");
      setResult({ gameId, password, data: body });
    } catch (e) { setError(e instanceof Error ? e.message : "無法取得用量"); }
    finally { setBusy(false); }
  }
  return <section className="card-euro my-6 rounded-lg p-5" aria-label="Gemini Token 用量">
    <h2 className="text-xl font-semibold">AI Token 用量</h2>
    <p className="my-3 text-sm">此遊戲自啟用紀錄起的 PDF 擷取與整理稿問答用量，包含重試。並非 Google 帳戶總用量或免費剩餘額度。</p>
    <button className="btn-euro min-h-11 rounded-lg px-4 disabled:opacity-50" disabled={(!password && !sessionActive) || busy} onClick={() => void refresh()}>{busy ? "讀取中…" : "更新 Token 用量"}</button>
    {(!password && !sessionActive) && <p className="mt-2 text-sm">請先填寫本頁管理密碼。</p>}
    {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
    {data && <div className="mt-4">
      <h3 className="my-3 font-semibold">本機模型</h3>
      <p className="mb-3 text-sm">本機推論不收雲端 API Token 費用，仍會消耗電力與電腦資源。下列為此遊戲已記錄的本機請求，包含測試。</p>
      {data.local_usage?.models.length ? data.local_usage.models.map(model => <div key={model.model} className="my-3 rounded-lg border border-grid-line p-3 text-sm"><p className="font-semibold">{model.model}</p><p>{model.requests} 次請求 · 輸入 {model.input_tokens.toLocaleString()} · 輸出 {model.output_tokens.toLocaleString()} · 合計 {(model.input_tokens + model.output_tokens).toLocaleString()} Token</p>{model.unknown_requests > 0 && <p>另有 {model.unknown_requests} 次用量不完整</p>}</div>) : <p className="my-3 text-sm">尚無本機模型紀錄。</p>}
      {!!data.local_usage?.operations?.length && <details className="my-3"><summary className="cursor-pointer py-2">依處理階段查看本機用量</summary><ul className="space-y-3 text-sm">{data.local_usage.operations.map(row => <li key={`${row.operation}:${row.model}`} className="rounded-lg border border-grid-line p-3"><p className="font-semibold">{stages[row.operation] || row.operation} · {row.model}</p><p>{row.requests} 次 · 輸入 {row.input_tokens.toLocaleString()} · 輸出 {row.output_tokens.toLocaleString()} Token</p>{row.unknown_requests > 0 && <p>另有 {row.unknown_requests} 次用量不完整</p>}<p>已知耗時 {(row.duration_seconds ?? 0).toFixed(1)} 秒；{row.unknown_duration_requests ?? row.requests} 次耗時未知</p></li>)}</ul><p className="mt-2 text-xs">耗時為有起訖紀錄的請求時間；歷史缺少紀錄不推估，快取命中不算新的模型請求。</p></details>}
      {!!data.local_usage?.documents?.length && <details className="my-3"><summary className="cursor-pointer py-2">依匯入文件查看本機用量</summary><ul className="space-y-3 text-sm">{data.local_usage.documents.map(row => <li key={JSON.stringify([row.document_id, row.operation, row.model])} className="rounded-lg border border-grid-line p-3"><p>{row.document_id ? `匯入文件 ${row.document_id}` : "文件未知（歷史紀錄未提供）"} · {stages[row.operation] || row.operation} · {row.model}</p><p>{row.requests} 次請求 · 輸入 {row.input_tokens.toLocaleString()} · 輸出 {row.output_tokens.toLocaleString()} Token · 用量不完整 {row.unknown_requests} 次</p><p>傳輸失敗 {row.failed_requests} 次 · 結果未知 {row.unknown_outcome_requests} 次 · 已知重試 {row.retry_requests} 次 · 重試資訊未知 {row.unknown_attempt_requests} 次</p><p>已知耗時 {(row.duration_seconds ?? 0).toFixed(1)} 秒；{row.unknown_duration_requests ?? row.requests} 次耗時未知</p></li>)}</ul><p className="mt-2 text-xs">文件以匯入任務識別；新分類請求已開始記錄，其他階段與歷史資料逐步補齊。收到回應不代表內容正確，未知欄位不推估。</p></details>}
      {!!data.local_usage?.cache_hits?.length && <details className="my-3"><summary className="cursor-pointer py-2">本機快取重用紀錄</summary><ul className="text-sm">{data.local_usage.cache_hits.map(row => <li key={JSON.stringify([row.document_id,row.model,row.operation])}>{row.document_id || "文件未知"} · {stages[row.operation] || row.operation} · {row.model} · {row.events} 次重用事件／{row.items} 個快取項目</li>)}</ul><p className="text-xs">這些重用不增加模型請求或 Token；同一項目再次被使用會另記一次。只含啟用紀錄後的索引、翻譯與重排快取，不回推歷史命中。</p></details>}
      <h3 className="my-3 font-semibold">Gemini 歷史用量</h3>
      <p role="status">Gemini 已停用；以下保留過往用量紀錄。</p>
      <p className="my-3">已記錄 {data.requests} 次請求</p>
      <dl className="grid grid-cols-2 gap-3 text-sm">{(Object.keys(labels) as (keyof Counts)[]).map(key => <div key={key}><dt>{labels[key]} Token</dt><dd>{data.totals[key].toLocaleString()}{data.unknown[key] > 0 && `（另有 ${data.unknown[key]} 次未知）`}</dd></div>)}</dl>
      <p className="my-3 text-xs">快取輸入包含於輸入數，請勿重複相加；總計採用 Google 回傳值。取得回應不代表規則已通過校對。</p>
      <details><summary className="cursor-pointer py-2">最近 20 次請求</summary><ul className="space-y-2 text-sm">{data.recent.map(row => <li key={row.id}>{new Date(row.created_at).toLocaleString("zh-TW")} · {row.model} · {row.operation} · {row.status === "received" ? "已取得回應" : "未完成或結果未知"} · {row.usage.total_tokens == null ? "Token 未知" : `${row.usage.total_tokens.toLocaleString()} Token`}</li>)}</ul></details>
    </div>}
  </section>;
}
