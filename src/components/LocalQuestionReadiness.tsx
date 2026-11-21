"use client";
import { useEffect, useState } from "react";

type Readiness = { status?: string; capabilities?: { qa?: { model: string; installed: boolean } } };
export default function LocalQuestionReadiness({ gameId }: { gameId: string }) {
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("正在確認本機問答模型…");
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setMessage("正在確認本機問答模型…");
    fetch(`/api/rules/knowledge/games/${encodeURIComponent(gameId)}/editorial/local-readiness`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 401 ? "登入已失效，請重新管理登入後確認模型狀態。" : "目前無法確認模型狀態；請確認本機 API 與 Ollama 服務。");
        const data: Readiness = await response.json();
        const qa = data.capabilities?.qa;
        const text = data.status === "unavailable" ? "本機模型服務無法連線；生成問答需先啟動 Ollama，再更新狀態。"
          : qa?.installed === true ? `已連線，問答模型 ${qa.model} 已安裝；尚未驗證本次生成與可用配額。`
          : qa?.installed === false ? `本機服務已連線，但缺少問答模型 ${qa.model}。`
          : "目前無法確認模型狀態；請確認本機 API 與 Ollama 服務。";
        if (!controller.signal.aborted) setMessage(text);
      }).catch(error => { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "無法確認模型狀態。"); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [gameId, revision]);
  return <div className="my-3 rounded-lg border border-amber-500 p-3">
    <p role="status">{message}</p>
    <p className="mt-2 text-sm">原文、已保存答案與來源表格可繼續使用。此檢查不啟動模型、不消耗推論 Token，也不代表背景工作已啟動或回答品質通過。</p>
    <button className="min-h-11 text-brass underline disabled:opacity-50" disabled={busy} onClick={() => setRevision(value => value + 1)}>更新模型狀態</button>
  </div>;
}
