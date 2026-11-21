"use client";
import { useState } from "react";

type Job = { id: string; filename: string };
type Link = { kind: string; edition: string; parent_job_id: string };
type Location = { kind: string; block: number; page: number };
export default function EditorialImportSource({ base, password, job, jobs }: { base: string; password: string; job: Job; jobs: Job[] }) {
  const [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [saved, setSaved] = useState<Link | null>(null), [kind, setKind] = useState("base"), [edition, setEdition] = useState(""), [parent, setParent] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [settingsVersion, setSettingsVersion] = useState(""), [editing, setEditing] = useState(false);
  const url = `${base}/${job.id}`;
  async function json(path: string, body?: object) {
    const response = await fetch(url + path, { method: body ? "POST" : "GET", cache: "no-store", headers: { "X-Knowledge-Admin": password, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "無法讀取來源資料");
    return data;
  }
  async function run(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "來源操作失敗"); } finally { setBusy(false); }
  }
  return <div className="mt-4 border-t border-grid-line pt-3">
    <button className="btn-euro min-h-11 rounded-lg px-3" disabled={busy} onClick={() => void run(async () => {
      const [document, source] = await Promise.all([json("/document"), json("/locations")]);
      setSaved(document.document); setSettingsVersion(document.settings_version || ""); setEditing(false); setLocations(source.locations.filter((item: Location) => item.kind === "image")); setLoaded(true);
    })}>文件關聯與來源裁切</button>
    {error && <p role="alert" className="my-2 text-red-700">{error}</p>}
    {loaded && <div className="mt-3 space-y-3">
      {saved && <p>文件：{({ base: "基本版", expansion: "擴充", errata: "勘誤" } as Record<string, string>)[saved.kind]} · 版本 {saved.edition}{saved.parent_job_id && ` · 依據 ${jobs.find(item => item.id === saved.parent_job_id)?.filename || saved.parent_job_id}`}</p>}
      {saved && !editing && settingsVersion && <button className="btn-euro min-h-11 rounded-lg px-3" disabled={busy} onClick={() => { setKind(saved.kind); setEdition(saved.edition); setParent(saved.parent_job_id); setEditing(true); }}>更正文件設定</button>}
      {(!saved || editing) && <>
        <p>設定這份來源的類型與版本。更正會保存新設定，舊答案保留原設定；不會自動合併或發布規則。</p>
        <label className="block">文件類型<select className="ml-2 rounded border p-2" value={kind} onChange={e => setKind(e.target.value)}><option value="base">基本版</option><option value="expansion">擴充</option><option value="errata">勘誤</option></select></label>
        <label className="block">文件版本<input className="ml-2 rounded border p-2" value={edition} maxLength={120} onChange={e => setEdition(e.target.value)} placeholder="例如：第二版／2025-01" /></label>
        {kind !== "base" && <label className="block">依據文件<select className="ml-2 max-w-full rounded border p-2" value={parent} onChange={e => setParent(e.target.value)}><option value="">選擇已分類的來源</option>{jobs.filter(item => item.id !== job.id).map(item => <option key={item.id} value={item.id}>{item.filename}</option>)}</select></label>}
        <button className="btn-euro min-h-11 rounded-lg px-3 disabled:opacity-50" disabled={busy || !edition.trim() || kind !== "base" && !parent} onClick={() => void run(async () => { const result = await json("/document", { kind, edition: edition.trim(), parent_job_id: kind === "base" ? "" : parent, ...(settingsVersion ? { expected_settings_version: settingsVersion } : {}) }); setSaved(result.document); setSettingsVersion(result.settings_version || ""); setEditing(false); })}>保存文件關聯</button>
        {editing && <button className="btn-euro ml-2 min-h-11 rounded-lg px-3" disabled={busy} onClick={() => setEditing(false)}>取消更正</button>}
      </>}
      <p>圖片裁切：{locations.length} 個。舊匯入若未保存定位，請下載完整來源核對。</p>
      <div className="flex max-h-64 flex-wrap gap-2 overflow-auto">{locations.map(item => <button key={`${item.page}-${item.block}`} className="btn-euro min-h-11 rounded px-3" disabled={busy} onClick={() => void run(async () => {
        const response = await fetch(`${url}/pages/${item.page}/blocks/${item.block}/image`, { cache: "no-store", headers: { "X-Knowledge-Admin": password } });
        if (!response.ok) throw new Error("無法取得原始裁切，請重新讀取來源資料");
        const objectUrl = URL.createObjectURL(await response.blob());
        const link = document.createElement("a"); link.href = objectUrl; link.download = `source-page-${item.page}-block-${item.block}.png`; link.click(); setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      })}>第 {item.page} 頁 · 圖片 {item.block}</button>)}</div>
    </div>}
  </div>;
}
