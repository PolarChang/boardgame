"use client";

import EditorialLogin from "@/components/EditorialLogin";
import EditorialCommunity from "@/components/EditorialCommunity";
import GeminiUsage from "@/components/GeminiUsage";
import EditorialAutoImport from "@/components/EditorialAutoImport";
import Link from "next/link";
import "../../knowledge.css";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import EditorialVisualImport from "@/components/EditorialVisualImport";
import EditorialFlowEditor from "@/components/EditorialFlowEditor";
import EditorialChanges from "@/components/EditorialChanges";
import EditorialReview from "@/components/EditorialReview";
import { draftKey } from "@/lib/editorial-local";
import EditorialDraftPreview from "@/components/EditorialDraftPreview";
import { editorialDiff, parseEditorial, serializeEditorial, validateDraft, validateEditorial, type EditorialDocument } from "@/lib/editorial";

const steps = [
  { id: "source", label: "匯入 PDF／圖片", short: "匯入" },
  { id: "review", label: "校對", short: "校對" },
  { id: "preview", label: "預覽", short: "預覽" },
  { id: "publish", label: "版本與發布", short: "發布" },
];
function workspaceFromUrl(fallback: string) {
  const params = new URLSearchParams(window.location.search);
  const step = params.get("step");
  return step === "import" || steps.some(item => item.id === step) ? step! : params.has("block") ? "review" : fallback;
}
type Release = { version: string; document: EditorialDocument | null };
type History = { id: string; created_at: string; published_at: string | null };
export default function EditorialManager() {
  const { gameId } = useParams<{ gameId: string }>();
  const base = `/api/rules/knowledge/games/${encodeURIComponent(gameId)}/editorial`;
  const [text, setText] = useState(""), [password, setPassword] = useState(""), [url, setUrl] = useState("");
  const [release, setRelease] = useState<Release | null>(null), [preview, setPreview] = useState<ReturnType<typeof parseEditorial> | null>(null);
  const [releaseUnavailable, setReleaseUnavailable] = useState(false);
  const [draft, setDraft] = useState(""), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [history, setHistory] = useState<History[]>([]), [rollback, setRollback] = useState("");
  const [sessionActive, setSessionActive] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [workspace, setWorkspaceState] = useState("source");
  const [editing, setEditing] = useState(false);
  const [reviewEpoch, setReviewEpoch] = useState(0);
  const [incoming, setIncoming] = useState<string | null>(null);
  const [diffFilter, setDiffFilter] = useState("");
  const [returnTo, setReturnTo] = useState(`/knowledge/${encodeURIComponent(gameId)}/reader`);
  useEffect(() => { const value = new URLSearchParams(window.location.search).get("returnTo"); const expected = `/knowledge/${encodeURIComponent(gameId)}/reader`; if (value && (value === expected || value.startsWith(expected + "?"))) setReturnTo(value); }, [gameId]);
  function setWorkspace(step: string) {
    const location = new URL(window.location.href);
    if (location.searchParams.get("step") !== step) {
      location.searchParams.set("step", step);
      window.history.pushState(null, "", location);
    }
    setWorkspaceState(step);
  }
  useEffect(() => {
    const restore = () => setWorkspaceState(workspaceFromUrl("source"));
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  function applyImport() {
    if (incoming === null) return;
    try { if (text) localStorage.setItem(`${draftKey(gameId)}:before-import`, text); }
    catch { setError("無法保存匯入前備份，尚未替換。請先下載備份並釋放瀏覽器儲存空間。"); return; }
    if (change(incoming)) { setIncoming(null); setReviewEpoch(value => value + 1); setWorkspace("review"); setNotice(text ? "已匯入。本次替換前的稿件已保留於本機備份。" : "已建立本機校對稿，尚未發布任何修改。"); }
  }
  async function request(path = "", body?: unknown) {
    const response = await fetch(base + path, { method: body ? "POST" : "GET", cache: "no-store", headers: { "Content-Type": "application/json", "X-Knowledge-Admin": password }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "操作失敗");
    return data;
  }
  useEffect(() => {
    let active = true;
    setRelease(null);
    setReleaseUnavailable(false);
    fetch(base, { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("無法讀取正式版");
      const data = await response.json();
      if (active) setRelease(data);
    }).catch(() => { if (active) setReleaseUnavailable(true); });
    return () => { active = false; };
  }, [base]);
  const [storageNotice, setStorageNotice] = useState("");
  useEffect(() => {
    try { const saved = localStorage.getItem(draftKey(gameId)); setText(saved || ""); setWorkspaceState(workspaceFromUrl(saved ? "review" : "source")); setPreview(saved ? parseEditorial(saved) : null); setStorageNotice(""); }
    catch { setStorageNotice("無法讀取瀏覽器儲存，請保留下載備份。"); }
  }, [gameId]);
  function change(value: string) {

    try { localStorage.setItem(draftKey(gameId), value); setSavedAt(new Date().toLocaleTimeString("zh-TW")); setText(value); setPreview(parseEditorial(value)); setDraft(""); setRollback(""); setConfirmed(false); setNotice(""); setStorageNotice(""); return true; }
    catch { setStorageNotice("自動儲存失敗（儲存空間不足或瀏覽器限制），請立即下載備份再離開。"); return false; }
  }
  function download(value = text, suffix = "editorial") { const blob = new Blob([value], { type: "text/markdown;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = gameId + "-" + suffix + ".md"; a.click(); URL.revokeObjectURL(url); }
  async function run(action: () => Promise<void>) { setBusy(true); setError(""); setNotice(""); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "操作失敗"); } finally { setBusy(false); } }
  const diff = preview && release ? editorialDiff(release.document, preview.document) : [];
  const canSaveDraft = Boolean(preview && release && !(preview.draftIssues || validateDraft(preview.document)).length && diff.length);
  async function publishDraft() {
    if (!release || !preview || !confirmed || preview.issues.length || (!rollback && !canSaveDraft)) return;
    const expectedVersion = release.version;
    let version = rollback || draft;
    if (!version) {
      const saved = await request("/drafts", { text, base_version: expectedVersion });
      version = saved.version;
      setDraft(version);
    }
    await request("/publish", { version, expected_version: expectedVersion, confirmed });
    setRelease({ version, document: preview.document });
    setDraft("");
    setRollback("");
    setConfirmed(false);
    setPreview(null);
    setNotice("正式版本已更新，讀者現在可查詢此版本。");
  }
  const importDiff = incoming === null ? [] : editorialDiff(parseEditorial(text).document, parseEditorial(incoming).document);
  return <main className="knowledge-page mx-auto max-w-6xl px-4 py-4 sm:px-8 sm:py-6">
    <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-3xl font-bold text-ink">規則管理</h1>
      <Link href="/knowledge/admin" className="inline-flex min-h-11 items-center text-sm text-brass underline">← 管理清單</Link>
      <Link href={returnTo} className="inline-flex min-h-11 items-center text-sm text-brass underline">← 查找規則</Link>
    </header>
    <nav aria-label="管理工作區" className="mb-4 grid grid-cols-4 border-b border-grid-line">
      {steps.map(item => <button key={item.id} disabled={editing} aria-label={item.label} aria-pressed={workspace === item.id} className={`min-h-11 border-b-2 px-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${workspace === item.id ? "border-brass font-semibold text-ink" : "border-transparent text-ink-light"}`} onClick={() => setWorkspace(item.id)}>{item.short}</button>)}
    </nav>
    <button type="button" disabled={editing || busy} className="min-h-11 text-brass underline" onClick={() => setWorkspace("import")}>匯入與備份</button>
    <div className="mb-4"><EditorialLogin gameId={gameId} onLogin={setSessionActive} embedded /></div>
    <div aria-live="polite">{error && <p role="alert" className="my-3 rounded-lg border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}{notice && <p className="my-3 text-sm text-green-800">{notice}</p>}</div>
    {releaseUnavailable && !release && (workspace === "import" || workspace === "publish") && <p role="status" className="my-3 text-sm text-amber-800">正式版暫時無法讀取。</p>}
    {editing && <p role="status" className="my-3 text-sm">請先儲存目前條目，再切換工作區。</p>}
    {storageNotice && <p role="alert" className="my-3 text-sm text-red-800">{storageNotice}</p>}
    <div hidden={workspace !== "source"}>
      <section className="card-euro space-y-4 rounded-lg p-4 sm:p-5" aria-labelledby="source-heading">
        <h2 id="source-heading" className="text-lg font-semibold">匯入規則書</h2>
        <div hidden={!sessionActive && !password} className="border-t border-grid-line pt-4">
          <EditorialAutoImport sessionActive={sessionActive} gameId={gameId} password={password} disabled={editing || busy} embedded onPreview={value => { setIncoming(value); setWorkspace("import"); setNotice("請確認匯入差異。"); }} />
        </div>
      </section>
      <details className="my-4 rounded-lg border border-grid-line px-3"><summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">本機處理用量</summary><GeminiUsage gameId={gameId} password={password} sessionActive={sessionActive} /></details>
    </div>
    <div hidden={workspace !== "review"}>
      <details className="my-4 rounded-lg border border-grid-line px-3"><summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">圖例與流程</summary>
    <EditorialVisualImport text={text} gameId={gameId} password={password} onAppend={block => { if (editing) { setError("請先儲存目前條目，再加入圖片。"); return false; } if (parseEditorial(text).document.blocks.some(b => b.id === block.id)) { setNotice("此圖片已在稿件中。"); return true; } return change(text.replace(/規則整理稿 v1/, "規則整理稿 v2") + "\n\n## 圖片 " + block.id + "\n" + Object.entries(block.fields).map(([key, value]) => key + "：" + value).join("\n")); }} />
    <EditorialFlowEditor text={text} disabled={editing || busy} onAppend={blocks => {
      if (editing || busy) return false;
      const existing = parseEditorial(text).document.blocks;
      if (blocks.some(block => existing.some(b => b.id === block.id))) { setError("流程編號重複，請重新建立。"); return false; }
      return change(text.replace(/規則整理稿 v1/, "規則整理稿 v2") + "\n\n" + serializeEditorial({blocks}).replace(/^# 規則整理稿 v2\n\n/, ""));
    }} />
      </details>
    </div>
    <div hidden={workspace !== "import"}>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 text-sm">
        <button disabled={!text} onClick={() => download()} className="min-h-11 text-brass underline">下載目前草稿備份</button>
        <button className="min-h-11 text-brass underline" onClick={() => { try { const backup = localStorage.getItem(`${draftKey(gameId)}:before-import`); if (backup) download(backup, "before-import"); else setNotice("尚無匯入前備份。"); } catch { setError("無法讀取備份。"); } }}>下載上次匯入前備份</button>
        <details><summary className="min-h-11 cursor-pointer py-3">儲存狀態</summary><p>{text ? `本機已存${savedAt ? ` · ${savedAt}` : ""}` : "尚無本機稿"} · {draft ? `伺服器 ${draft.slice(0, 10)}` : "尚無伺服器草稿"}</p></details>
      </div><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="card-euro rounded-lg p-5"><h2 className="text-xl font-semibold">1. 匯入整理稿</h2>
        {release?.document && <div className="my-4 rounded-lg border border-grid-line p-4"><p className="text-sm leading-7">從目前正式版 {release.version.slice(0, 10)} 建立校對稿；先比較差異，再備份及套用到本機。</p><button className="btn-euro mt-3 min-h-11 rounded-lg px-4" disabled={busy || editing} onClick={() => setIncoming(serializeEditorial(release.document!))}>以正式版建立校對稿</button></div>}
        <a className="mt-3 inline-block min-h-11 text-brass underline" href="/templates/rules-editorial-v1.md" download>下載 NotebookLM 通用範本（Markdown）</a>
        <details className="mb-3 text-sm text-ink-light"><summary className="min-h-11 cursor-pointer py-3">整理稿格式與備份提示</summary><p>保留範本的段落與欄位名稱；狀態只有在核對原文後才改為「已確認」。草稿會自動儲存在目前瀏覽器，尚未同步伺服器；清除瀏覽器資料會移除草稿，請定期下載備份。</p></details>
        <label className="block text-sm font-semibold">選取 .md / .txt 整理稿<input className="mt-2 block w-full text-sm" type="file" accept=".md,.txt,text/plain,text/markdown" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 2_000_000) { setError("檔案不可超過 2 MB"); return; } void file.text().then(setIncoming).catch(() => setError("無法讀取檔案")); e.target.value = ""; }} /></label>
        {incoming !== null && <section aria-label="匯入預覽" className="my-4 rounded-lg border-2 border-brass p-4"><h3 className="font-semibold">替換前確認</h3><p className="my-3 text-sm">新稿版本：{parseEditorial(incoming).document.blocks.find(b => b.kind === "文件")?.fields.版本 || "未提供"} · {parseEditorial(incoming).issues.length} 項待辦</p><p className="text-sm">與目前本機稿比較：{["新增", "修改", "刪除"].map(kind => `${kind} ${importDiff.filter(d => d.change === kind).length}`).join(" · ")}</p><details className="my-3"><summary>檢視替換差異</summary>{importDiff.map(d => <div key={d.id} className="my-3 border-t border-grid-line pt-3"><p>{d.change} · {d.id}</p><EditorialChanges before={d.before} after={d.after} /></div>)}</details><div className="flex flex-wrap gap-3"><button className="btn-euro min-h-11 rounded-lg" onClick={() => setIncoming(null)}>取消匯入</button><button className="btn-euro-primary min-h-11 rounded-lg" onClick={applyImport}>備份目前稿並套用匯入</button></div></section>}
        <label className="mt-5 block text-sm font-semibold">整理稿文字<textarea className="input-euro mt-2 min-h-80 w-full rounded-lg p-3 font-mono text-sm" value={text} disabled={busy} onChange={e => change(e.target.value)} placeholder="貼上 # 規則整理稿 v1 與所有段落…" /></label>
        <button className="btn-euro-primary mt-3 min-h-11 rounded-lg px-5 disabled:opacity-50" disabled={busy || !text.trim()} onClick={() => { setPreview(parseEditorial(text)); setDraft(""); setRollback(""); setConfirmed(false); setWorkspace("preview"); }}>檢查整理稿（不使用 AI）</button>
      </section>
      <aside className="space-y-5">
        <section className="card-euro rounded-lg p-5"><h2 className="font-semibold">管理員存取</h2><label className="mt-3 block text-sm">管理密碼<input type="password" autoComplete="off" className="input-euro mt-2 min-h-11 w-full rounded-lg px-3" value={password} onChange={e => setPassword(e.target.value)} /></label></section>
        <section className="card-euro rounded-lg p-5"><h2 className="font-semibold">從 Google Docs 讀取</h2><details className="text-xs text-ink-light"><summary className="min-h-11 cursor-pointer py-3">Google Docs 分享方式</summary><p className="break-all">將文件以檢視者分享給：boardgame-rules-run@boardgame-rules-507516.iam.gserviceaccount.com</p></details><label className="mt-3 block text-sm">文件連結<input type="url" className="input-euro mt-2 min-h-11 w-full rounded-lg px-3" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://docs.google.com/document/d/…" /></label><button disabled={busy || !url || (!password && !sessionActive)} className="btn-euro mt-3 min-h-11 rounded-lg disabled:opacity-50" onClick={() => void run(async () => { const data = await request("/google-doc", { url }); setIncoming(data.text); setNotice("文件已讀取，請檢查替換差異後套用。"); })}>手動讀取文件</button></section>
        <p className="text-sm leading-6 text-ink-light">目前正式版：{release === null ? "尚未載入" : release.version ? release.version.slice(0, 10) : "尚未發布"}</p>
      </aside>
    </div>
    </div><div hidden={workspace !== "review"}>{text ? <div id="draft-review"><EditorialReview key={reviewEpoch} gameId={gameId} password={password} text={text} onChange={change} onDirtyChange={setEditing} /></div> : <p className="my-5">尚無校對稿。請先匯入規則書或整理稿。</p>}{text && <button type="button" disabled={editing || busy} className="btn-euro-primary my-4 min-h-11 rounded-lg px-4" onClick={() => setWorkspace("preview")}>下一步：預覽</button>}</div>
    {workspace === "preview" && <section className="my-5">
      <h2 className="text-xl font-semibold">預覽讀者畫面</h2>
      <p className="my-2 text-sm text-ink-light">草稿 · 尚未發布</p>
      {preview ? <>
        <EditorialDraftPreview key={text + rollback} document={preview.document} published />
        {preview.issues.length > 0 && <p role="status">還有 {preview.issues.length} 項待處理。發布前請完成校對。</p>}
        <div className="my-4 flex flex-wrap gap-3">
          <button type="button" className="btn-euro min-h-11 rounded-lg px-4" onClick={() => setWorkspace("review")}>返回校對</button>
          <button type="button" className="btn-euro-primary min-h-11 rounded-lg px-4" onClick={() => setWorkspace("publish")}>前往發布</button>
        </div>
      </> : <p>請先匯入或建立校對稿。</p>}
    </section>}
    <div hidden={workspace !== "publish"}>
    {preview && <section className="mt-6"><h2 className="text-xl font-semibold">發布前檢查</h2><details className="text-sm"><summary className="min-h-11 cursor-pointer py-3">檢查範圍</summary><p>檢查只確認格式。發布前請核對譯文與規則。</p></details>
      {preview.issues.length > 0 ? <div className="my-4 rounded-lg border border-red-300 bg-red-50 p-5 text-sm text-red-800"><p role="status">已讀取 {preview.document.blocks.filter(b => b.kind === "規則").length} 條規則、{preview.document.blocks.filter(b => b.kind === "FAQ").length} 則 FAQ；共 {preview.issues.length} 項待處理，暫不可發布。</p><ul className="mt-3 space-y-2">{preview.issues.slice(0, 8).map((issue, i) => <li key={i}>{issue.id}：{issue.message}</li>)}</ul>{preview.issues.length > 8 && <details className="mt-3"><summary className="cursor-pointer">展開其餘 {preview.issues.length - 8} 項</summary><ul className="mt-3 space-y-2">{preview.issues.slice(8).map((issue, i) => <li key={i}>{issue.id}：{issue.message}</li>)}</ul></details>}</div> : <p className="my-4 text-green-800">結構檢查通過，共 {preview.document.blocks.filter(b => b.kind === "規則").length} 條規則。請繼續核對差異。</p>}
      {!release && <p role="status" className="my-3">尚未取得正式版，暫不計算差異。請確認連線後重新載入。</p>}
      <label className="my-3 block text-sm">差異種類<select className="input-euro ml-3 rounded-lg" value={diffFilter} onChange={e => setDiffFilter(e.target.value)}>{["", "新增", "修改", "刪除"].map(v => <option key={v} value={v}>{v || "全部差異"} {v ? diff.filter(d => d.change === v).length : diff.length}</option>)}</select></label>
      <div className="space-y-3">{diff.filter(d => !diffFilter || d.change === diffFilter).map(d => <details className="rounded-lg border border-grid-line p-4" key={d.id}><summary className="min-h-8 cursor-pointer font-semibold">{d.change} · {d.id}</summary><EditorialChanges before={d.before} after={d.after} /></details>)}</div>
      <div className="card-euro mt-5 rounded-lg p-5"><h2 className="text-xl font-semibold">發布規則</h2><details className="my-3"><summary className="cursor-pointer text-sm">只儲存草稿</summary><button disabled={busy || (!password && !sessionActive) || !release || (preview.draftIssues || validateDraft(preview.document)).length > 0 || !diff.length || !!rollback} className="btn-euro my-4 min-h-11 rounded-lg disabled:opacity-50" onClick={() => void run(async () => { const data = await request("/drafts", { text, base_version: release?.version || "" }); setDraft(data.version); setNotice("草稿已儲存到伺服器，尚未發布。"); })}>儲存伺服器草稿</button></details>
        <p className="mb-4 text-sm leading-7">核對完成後即可發布。發布時會自動儲存草稿。</p><label className="flex items-start gap-3 text-sm leading-6"><input className="mt-1 h-5 w-5" type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />我已逐項核對原文、中文、數字、條件及例外，並確認以上差異可發布。</label>
        <button disabled={busy || (!password && !sessionActive) || !release || !confirmed || (!rollback && !canSaveDraft) || preview.issues.length > 0} className="btn-euro-primary mt-4 min-h-11 rounded-lg px-5 disabled:opacity-50" onClick={() => void run(publishDraft)}>{busy ? "處理中…" : rollback ? "確認還原此版本" : "發布已確認版本"}</button>
      </div>
    </section>}
    <section className="card-euro mt-6 rounded-lg p-5"><h2 className="text-xl font-semibold">歷史版本與草稿</h2><button disabled={busy || (!password && !sessionActive)} className="btn-euro my-3 min-h-11 rounded-lg disabled:opacity-50" onClick={() => void run(async () => { setHistory((await request("/history")).versions); })}>讀取版本紀錄</button><ul className="space-y-3">{history.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-grid-line py-3 text-sm"><span>{item.id.slice(0, 10)} · {new Date(item.created_at).toLocaleString("zh-TW")} · {item.published_at ? "曾發布" : "草稿"}</span><button className="btn-euro min-h-11 rounded-lg" disabled={busy} onClick={() => void run(async () => { const [data, current] = await Promise.all([request(`/versions/${item.id}`), request()]); setRelease(current); setPreview({ document: data.document, issues: validateEditorial(data.document) }); setRollback(item.id); setDraft(""); setConfirmed(false); setWorkspace("preview"); setNotice("已載入歷史版本，請預覽後回到發布頁。"); })}>預覽此版本</button></li>)}</ul></section>
    </div>
    <details className="my-4 rounded-lg border border-grid-line px-3"><summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">社群與補充</summary><EditorialCommunity gameId={gameId} password={password} /></details>
</main>;
}
