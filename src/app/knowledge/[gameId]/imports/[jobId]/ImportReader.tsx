"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ImportQuestionHistory, { type SavedQuestion } from "@/components/ImportQuestionHistory";
import ImportQuestionSubmit from "@/components/ImportQuestionSubmit";
import ImportContextSave from "@/components/ImportContextSave";
import LocalQuestionReadiness from "@/components/LocalQuestionReadiness";
import ImportQuality from "@/components/ImportQuality";
import EditorialLogin from "@/components/EditorialLogin";
import ImportSourceImages from "@/components/ImportSourceImages";
import EditorialDraftPreview from "@/components/EditorialDraftPreview";
import EditorialBlockCard from "@/components/EditorialBlockCard";
import { type EditorialDocument } from "@/lib/editorial";
import "../../../knowledge.css";

type Classification = { classified_rules: number; total_rules: number; unassigned_rules: number; queued: number; processing: number; done: number; unresolved: number; budget_exhausted: boolean; waiting_budget?: number; waiting_service?: number; daily_paused?: boolean; historical_tasks?: number };
type Snapshot = { classification?: Classification; readable_pages?: number; layout_tables?: number; version: string; document: EditorialDocument; completed_pages: number; total: number };
type SourceSettings = { kind: string; edition: string; parent_job_id?: string };
type Settings = { settings_version: string; document: SourceSettings | null };
const settingsLabel = (value: SourceSettings | null | undefined) => value ? `${({ base: "基本版", expansion: "擴充", errata: "勘誤" } as Record<string, string>)[value.kind] || value.kind} · ${value.edition}` : "版本／擴充尚未設定";
type ConfirmedContext = { role: string; players: string; stage: string; situation: string };
const contextLabels = { role: "角色", players: "人數", stage: "階段／時機", situation: "已確認局面" };
type Answer = { confirmed_context?: Partial<ConfirmedContext>; settings_version?: string; source_settings?: SourceSettings | null; answer: string; citations: string[]; kind: string; answer_id?: string; coverage_gaps?: string[]; retrieved_ids?: string[]; status?: "complete" | "partial" | "needs_context" | "conflict" | "insufficient"; claims?: { text: string; evidence: { id: string; quote: string }[] }[] };
const answerStatuses = { complete: "完整回答", partial: "部分回答", needs_context: "需要補充情境", conflict: "來源存在衝突", insufficient: "來源不足" };
function answerStatus(answer: Answer) {
  if (answer.status && answer.status !== "complete") return answer.status;
  if (answer.kind === "partial" || answer.coverage_gaps?.length) return "partial";
  return answer.status;
}
const headings = { rules: "查規則", source: "看原書", questions: "問規則", info: "文件資訊" };
type View = keyof typeof headings;

export default function ImportReader({ view }: { view: View }) {
  const { gameId, jobId } = useParams<{ gameId: string; jobId: string }>();
  return <ImportReaderContent key={`${gameId}/${jobId}/${view}`} gameId={gameId} jobId={jobId} view={view} />;
}
function ImportReaderContent({ gameId, jobId, view }: { gameId: string; jobId: string; view: View }) {
  const base = `/api/rules/knowledge/games/${encodeURIComponent(gameId)}/editorial/imports/${encodeURIComponent(jobId)}`;
  const [active, setActive] = useState(false), [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [context, setContext] = useState<ConfirmedContext>({ role: "", players: "", stage: "", situation: "" });
  const [contextReady, setContextReady] = useState(false);
  const [answerSnapshot, setAnswerSnapshot] = useState<Snapshot | null>(null);
  const answerRequest = useRef(0);
  const readerPath = `/knowledge/${encodeURIComponent(gameId)}/imports/${encodeURIComponent(jobId)}`;
  const [location, setLocation] = useState({ version: "", page: 1 });
  const versionQuery = location.version ? `?version=${encodeURIComponent(location.version)}` : "";
  const sourceHref = (page: number, version: string) => `${readerPath}/source?${new URLSearchParams({ page: String(page), version })}`;
  const [historyRevision, setHistoryRevision] = useState(0);
  useEffect(() => () => { answerRequest.current += 1; }, []);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [question, setQuestion] = useState(""), [answer, setAnswer] = useState<Answer | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!active) { answerRequest.current += 1; setSnapshot(null); setAnswer(null); setAnswerSnapshot(null); setSettings(null); return; }
    let current = true;
    setSnapshot(null); setAnswer(null); setError("");
    setSettings(null);
    if (view === "questions") fetch(base + "/document", { cache: "no-store" }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "無法讀取適用設定");
      if (current) setSettings(data);
    }).catch(e => { if (current) setError(e.message); });
    const params = new URLSearchParams(window.location.search);
    const pinnedVersion = params.get("version");
    const page = Number(params.get("page"));
    setLocation({ version: pinnedVersion || "", page: Number.isSafeInteger(page) && page > 0 ? page : 1 });
    fetch(base + "/draft" + (pinnedVersion ? `?version=${encodeURIComponent(pinnedVersion)}` : ""), { cache: "no-store" }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "無法讀取匯入稿");
      if (current) setSnapshot(data);
    }).catch(e => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [base, active, view]);
  useEffect(() => {
    if (!active || !snapshot || busy || answer || view === "source") return;
    if (new URLSearchParams(window.location.search).has("version")) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(base + "/draft", { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "無法更新匯入進度");
        if (!controller.signal.aborted) { setSnapshot(data); setError(""); }
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "無法更新匯入進度");
          setSnapshot(previous => previous ? { ...previous } : previous);
        }
      }
    }, 15000);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [base, active, snapshot, busy, answer, view]);
  async function ask() {
    if (!snapshot || !settings?.settings_version || !contextReady || busy) return;
    const request = ++answerRequest.current;
    setBusy(true); setError(""); setAnswer(null); setAnswerSnapshot(null);
    try {
      const response = await fetch(base + "/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, version: snapshot.version, settings_version: settings.settings_version, confirmed_context: Object.fromEntries(Object.entries(context).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()])) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "無法試問");
      if (request === answerRequest.current) { setAnswer(data); setAnswerSnapshot(snapshot); setHistoryRevision(value => value + 1); }
    } catch (e) { setError(e instanceof Error ? e.message : "無法試問"); } finally { setBusy(false); }
  }
  async function openSaved(job: SavedQuestion) {
    const request = ++answerRequest.current;
    setAnswer(null); setAnswerSnapshot(null);
    const response = await fetch(`${base}/draft?version=${encodeURIComponent(job.question.version)}`, { cache: "no-store" });
    const original = await response.json();
    if (!response.ok) throw new Error(original.error || "無法讀取回答的原始版本");
    if (original.version !== job.question.version) throw new Error("來源版本不符，無法顯示歷史引用");
    if (request !== answerRequest.current) return;
    setAnswerSnapshot(original); setAnswer(job.result as Answer);
  }
  return <main className="knowledge-page mx-auto max-w-6xl px-4 py-8">
    <Link className="inline-flex min-h-11 items-center text-brass underline" href={view === "rules" ? `/knowledge/${encodeURIComponent(gameId)}/manage` : readerPath + versionQuery}>{view === "rules" ? "← 匯入管理" : "← 查規則"}</Link>
    <h1 className="my-3 text-3xl font-bold">{headings[view]}</h1>
    <EditorialLogin gameId={gameId} onLogin={setActive} embedded />
    {active && !snapshot && !error && <p role="status">載入規則書…</p>}
    {error && <p role="alert" className="my-4 text-red-800">{error}</p>}
    {active && snapshot && <>
      {view === "rules" && <>
        <nav aria-label="規則書連結" className="my-3 flex flex-wrap gap-x-5 text-sm text-brass underline">
          <Link className="inline-flex min-h-11 items-center" href={readerPath + "/source" + versionQuery}>看原書</Link>
          <Link className="inline-flex min-h-11 items-center" href={readerPath + "/questions" + versionQuery}>問規則</Link>
        </nav>
        <EditorialDraftPreview document={snapshot.document} sourceHref={page => sourceHref(page, snapshot.version)} version={snapshot.version} />
        <Link className="inline-flex min-h-11 items-center text-sm text-brass underline" href={readerPath + "/info" + versionQuery}>文件資訊</Link>
      </>}
      {view === "source" && <ImportSourceImages base={base} initialPage={location.page} totalPages={snapshot.total} version={snapshot.version} />}
      {view === "questions" && <>
      <section className="card-euro my-5 rounded-lg p-5" aria-label="待校對稿試問">
        <details className="my-2"><summary className="min-h-11 cursor-pointer py-3">情境與問答設定</summary>
        <LocalQuestionReadiness key={gameId} gameId={gameId} />
        <p className="my-2" role="status">目前適用：{settings ? settingsLabel(settings.document) : "正在讀取設定…"}。此書尚未完成品質驗收，回答仍需核對來源。</p>
        <p className="text-sm"><Link className="text-brass underline" href={`/knowledge/${encodeURIComponent(gameId)}/manage`}>設定或更正文件版本</Link>；完成後重新載入此頁供後續提問使用，既有答案保留原設定。</p>
        {Boolean(snapshot.layout_tables) && <button className="my-2 min-h-11 text-brass underline" onClick={() => setQuestion("最終計分的來源座標表格有哪些？")}>查看計分來源表格（不耗模型 Token）</button>}
        <fieldset className="my-3 grid gap-3 sm:grid-cols-2" disabled={busy || !contextReady}><legend>已確認的情境（選填，不確定請留白）</legend>{(Object.keys(contextLabels) as (keyof ConfirmedContext)[]).map(key => <label key={key}>{contextLabels[key]}<input className="input-euro mt-1 block min-h-11 w-full rounded-lg p-2" maxLength={{ role: 120, players: 40, stage: 200, situation: 500 }[key]} value={context[key]} onChange={event => setContext(previous => ({ ...previous, [key]: event.target.value }))} /></label>)}</fieldset>
        {settings && <ImportContextSave key={settings.settings_version} base={base} version={settings.settings_version} context={context} onLoaded={setContext} onReady={setContextReady} disabled={busy} />}
        </details>
        <p className="text-sm text-ink-light">回答請對照原書。</p>
        <label className="my-3 block">想詢問的規則<textarea maxLength={500} className="input-euro mt-2 block min-h-24 w-full rounded-lg p-3" value={question} onChange={e => setQuestion(e.target.value)} placeholder="例如：遊戲最終計分方式是什麼？" /></label>
        <button disabled={busy || !contextReady || !settings?.settings_version || question.trim().length < 2} className="btn-euro-primary min-h-11 rounded-lg px-4 disabled:opacity-50" onClick={() => void ask()}>{busy ? "本機查詢中…" : "試問此版本"}</button>
        {process.env.NEXT_PUBLIC_LOCAL_BACKGROUND_QA === "true" && settings && <ImportQuestionSubmit base={base} disabled={busy || !contextReady || question.trim().length < 2} question={{ question: question.trim(), version: snapshot.version, settings_version: settings.settings_version, confirmed_context: Object.fromEntries(Object.entries(context).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()])) }} onSubmitted={() => setHistoryRevision(value => value + 1)} />}
        {answer && <article className="mt-4">{answerSnapshot && <p className="mb-2 text-sm">本回答來源版本：{answerSnapshot.version.slice(0, 12)}{answerSnapshot.version !== snapshot.version ? "（與目前閱讀版本不同）" : ""}</p>}<p className="mb-2 text-sm">本回答情境：{Object.entries(answer.confirmed_context || {}).map(([key, value]) => `${contextLabels[key as keyof ConfirmedContext] || key}：${value}`).join("；") || "未指定"}。本回答適用：{settingsLabel(answer.source_settings)}{answer.settings_version && settings?.settings_version !== answer.settings_version ? "（與目前設定不同）" : ""}</p>{answerStatus(answer) && <p role="status" className="mb-2 font-semibold">{answerStatuses[answerStatus(answer)!]}</p>}<p className="whitespace-pre-wrap leading-7">{answer.answer}</p>{answer.claims?.map((claim, index) => <details key={index} className="my-3"><summary className="min-h-11 cursor-pointer">結論 {index + 1} 的原文依據</summary><p>{claim.text}</p>{claim.evidence.map((e, i) => <blockquote key={i} className="my-2 border-l-2 pl-3"><p>{e.quote}</p><span className="text-sm">{e.id}</span></blockquote>)}</details>)}{!!answer.coverage_gaps?.length && <div role="status" className="my-3 border border-amber-500 p-3"><p>回答尚有缺漏：</p>{answer.coverage_gaps.map(gap => <p key={gap}>{gap}</p>)}</div>}<p className="my-2 text-sm">自動整理結果，可能存在辨識缺漏；可展開來源或提供回饋。</p>{[...new Set([...answer.citations, ...(answer.retrieved_ids || [])])].map(id => {
          const block = answerSnapshot?.document.blocks.find(b => b.id === id);
          return block && <details key={id}><summary className="min-h-11 cursor-pointer text-brass underline">{answer.citations.includes(id) ? "核對引用" : "檢索候選（不是答案依據）"} {id} · PDF 第 {block.fields.PDF頁碼} 頁</summary>{/^\d+$/.test(block.fields.PDF頁碼 || "") && <Link className="text-brass underline" href={sourceHref(Number(block.fields.PDF頁碼), answerSnapshot!.version)}>看原文 · 第 {block.fields.PDF頁碼} 頁</Link>}<EditorialBlockCard block={block} /></details>;
        })}</article>}
        {answer && <button className="my-2 min-h-11 text-brass underline" onClick={() => { answerRequest.current += 1; setAnswer(null); setAnswerSnapshot(null); }}>結束本次回答並恢復進度更新</button>}
      </section>
        <details className="my-4 rounded-lg border border-grid-line px-4"><summary className="min-h-11 cursor-pointer py-3">問答紀錄與回饋</summary>
          <ImportQuestionHistory key={`${base}/answers`} base={base} mode="answers" revision={historyRevision} onOpen={openSaved} /><ImportQuestionHistory key={`${base}/${historyRevision}`} base={base} onOpen={openSaved} />
      <ImportQuality key={`${base}/${answer?.answer_id || "none"}`} base={base} version={answerSnapshot?.version || snapshot.version} answerId={answer?.answer_id} />
        </details>
      </>}
      {view === "info" && <section className="my-4 rounded-lg border border-grid-line p-4 text-sm">
      <p role="status">可讀 {snapshot.readable_pages ?? snapshot.completed_pages}／{snapshot.total} 頁 · 模型整理完成 {snapshot.completed_pages} 頁 · 版本 {snapshot.version.slice(0, 12)}</p>
      <p className="my-2 text-sm"><a className="text-brass underline" href={`?version=${encodeURIComponent(snapshot.version)}`}>固定閱讀此版本（停止自動更新）</a> · <a className="text-brass underline" href={readerPath + "/info"}>查看最新版本</a></p>
      {snapshot.classification && <p role="status" className="my-3">分類涵蓋 {snapshot.classification.classified_rules}／{snapshot.classification.total_rules} 則 · 尚未分類 {snapshot.classification.unassigned_rules} 則 · 排隊 {snapshot.classification.queued} · 處理中 {snapshot.classification.processing} · 未完成工作 {snapshot.classification.unresolved}。分類僅供導覽，不代表規則內容已驗證。{snapshot.classification.budget_exhausted && "本輪分類工作額度已用完；其餘原文仍可閱讀與查詢。"}</p>}
      {!!snapshot.classification?.waiting_budget && <p role="status">{snapshot.classification.waiting_budget} 筆分類工作等待預算；額度恢復後自動續跑，原文仍可閱讀。</p>}
      {!!snapshot.classification?.waiting_service && <p role="status">{snapshot.classification.waiting_service} 筆分類工作正在等待本機模型服務或 GPU 空檔，系統稍後自動重試；原文仍可閱讀，不扣內容品質重試次數。</p>}
      {snapshot.classification?.daily_paused && <p role="status">本機分類已達今日呼叫上限，等待額度重置後續跑；原文仍可閱讀與查詢。</p>}
      {!!snapshot.classification?.historical_tasks && <p className="text-sm">另保留 {snapshot.classification.historical_tasks} 筆舊版分類工作，未計入本輪完成數。</p>}
      {snapshot.completed_pages < snapshot.total && <p className="my-3">先提供已擷取原文；模型整理尚未完成，不表示背景工作正在執行。尚未辨識的內容可能影響回答完整性。</p>}
      {Boolean(snapshot.layout_tables) && <p className="my-3" role="status">已自動補強 {snapshot.layout_tables} 張來源座標表格，查詢會直接使用，無需人工套用。</p>}
      <a className="btn-euro my-3 inline-flex min-h-11 items-center rounded-lg px-4" href={base + "/source"}>下載此版本來源 PDF 核對</a>
      </section>}
    </>}
  </main>;
}

