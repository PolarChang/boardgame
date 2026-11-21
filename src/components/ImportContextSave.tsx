"use client";
import { useEffect, useRef, useState } from "react";

type Context = { role: string; players: string; stage: string; situation: string };
export default function ImportContextSave({ base, version, context, onLoaded, onReady, disabled = false }: {
  base: string; version: string; context: Context; onLoaded: (context: Context) => void; onReady: (ready: boolean) => void; disabled?: boolean;
}) {
  const [revision, setRevision] = useState<number | null>(null);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    setRevision(null); setError(""); setSaved(""); setBusy(true); onReady(false);
    fetch(`${base}/context?settings_version=${encodeURIComponent(version)}`, { cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.detail || "無法讀取已保存情境");
      if (!Number.isInteger(data.revision) || data.revision < 0 || !data.confirmed_context ||
          !["role", "players", "stage", "situation"].every(key => typeof data.confirmed_context[key] === "string")) throw new Error("情境資料格式不完整，請重新讀取");
      if (generation.current !== current) return;
      onLoaded(data.confirmed_context); setRevision(data.revision); setSaved(JSON.stringify(data.confirmed_context)); onReady(true);
    }).catch(error => { if (generation.current === current) setError(error instanceof Error ? error.message : "無法讀取情境"); })
      .finally(() => { if (generation.current === current) setBusy(false); });
    return () => { generation.current += 1; };
  }, [base, version, onLoaded, onReady, reload]);
  async function save() {
    if (revision === null || busy) return;
    const current = generation.current;
    const submitted = { ...context };
    setBusy(true); setError("");
    try {
      const response = await fetch(base + "/context", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings_version: version, expected_revision: revision, confirmed_context: submitted }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.detail || "保存情境失敗");
      if (generation.current !== current) return;
      setRevision(data.revision); setSaved(JSON.stringify(submitted));
    } catch (error) { if (generation.current === current) setError(error instanceof Error ? error.message : "保存情境失敗"); }
    finally { if (generation.current === current) setBusy(false); }
  }
  return <div className="my-3 space-y-2">
    <p className="text-sm" role="status">{busy ? "正在同步情境…" : revision === null ? "已保存情境尚未載入。" : saved === JSON.stringify(context) ? "此版本情境已保存，重新開啟後會載入。" : "情境有未保存變更；離頁前請保存。"}</p>
    <button className="btn-euro min-h-11 rounded-lg px-3 disabled:opacity-50" disabled={disabled || busy || revision === null || saved === JSON.stringify(context)} onClick={() => void save()}>保存情境</button>
    {error && <><p role="alert" className="text-red-700">{error}</p><button className="btn-euro min-h-11 rounded-lg px-3" disabled={disabled || busy} onClick={() => setReload(value => value + 1)}>重新讀取已保存情境（取代欄位內容）</button></>}
    <p className="text-sm">只保存你確認的情境，不保存模型推測；不同文件與版本分開保存。欄位清空後保存可重設情境。</p>
  </div>;
}
