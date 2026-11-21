"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ids, pages, type EditorialDocument } from "@/lib/editorial";
import { answerSchema, conversationKey, conversationSchema, saveKnowledgeAnswer, type KnowledgeMessage } from "@/lib/knowledge-records";
import EditorialVisuals from "./EditorialVisuals";
import EditorialBlockCard from "./EditorialBlockCard";
import AnswerReferences from "./AnswerReferences";
import { answerEvidence } from "@/lib/knowledge-evidence";

export default function EditorialConversation({ gameId, version, document, query, publicRead = false, sourceHref }: { gameId: string; version: string; document: EditorialDocument; query: string; publicRead?: boolean; sourceHref?: (page: number, blockId: string) => string }) {
  return <ConversationContent key={JSON.stringify([gameId, version, publicRead])} {...{ gameId, version, document, query, publicRead, sourceHref }} />;
}

function ConversationContent({ gameId, version, document, query, publicRead, sourceHref }: { gameId: string; version: string; document: EditorialDocument; query: string; publicRead: boolean; sourceHref?: (page: number, blockId: string) => string }) {
  const [question, setQuestion] = useState(""), [selected, setSelected] = useState("");
  const [context, setContext] = useState({ role: "", players: "", expansion: "", stage: "" });
  const [messages, setMessages] = useState<KnowledgeMessage[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [ready, setReady] = useState(!publicRead), [storageNotice, setStorageNotice] = useState("");
  const [saveStates, setSaveStates] = useState<Record<number, { busy?: boolean; id?: string; error?: string }>>({});
  const [expanded, setExpanded] = useState<string[]>([]);
  const [reviews, setReviews] = useState<Record<string, { question: string; confirmed: boolean }>>({});
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const pendingRequest = useRef<{ payload: string; id: string } | null>(null);
  const key = conversationKey(gameId, version);
  useEffect(() => {
    if (!publicRead) return;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const state = conversationSchema.parse(JSON.parse(raw));
        setQuestion(state.question); setSelected(state.selected); setContext(state.context); setMessages(state.messages); setExpanded(state.expanded); setReviews(state.reviews); pendingRequest.current = state.pending;
      }
    } catch { setStorageNotice("無法恢復對話。離頁前請先保存需要的答案；本頁輸入可能無法保留。"); }
    setReady(true);
  }, [key, publicRead]);
  function persist() {
    if (!publicRead) return;
    try { sessionStorage.setItem(key, JSON.stringify({ question, selected, context, messages, expanded, reviews, pending: pendingRequest.current })); }
    catch { setStorageNotice("瀏覽器無法保留對話。離頁前請先保存需要的答案；本頁輸入可能無法保留。"); }
  }
  useEffect(() => {
    if (!publicRead || !ready) return;
    try { sessionStorage.setItem(key, JSON.stringify({ question, selected, context, messages, expanded, reviews, pending: pendingRequest.current })); }
    catch { setStorageNotice("瀏覽器無法保留對話。離頁前請先保存需要的答案；本頁輸入可能無法保留。"); }
  }, [key, publicRead, ready, question, selected, context, messages, expanded, reviews, busy]);
  async function saveAnswer(index: number) {
    setSaveStates(old => ({ ...old, [index]: { busy: true } }));
    try {
      const record = await saveKnowledgeAnswer(localStorage, gameId, version, document, messages[index], reviews[index]);
      setSaveStates(old => ({ ...old, [index]: { id: record.id } }));
      setReviewIndex(null);
    } catch { setSaveStates(old => ({ ...old, [index]: { error: "保存失敗，請確認瀏覽器允許儲存且有足夠空間，再重試。答案仍保留在本頁。" } })); }
  }
  async function ask() {
    const text = (question || query).trim(); if (text.length < 2 || busy || !ready) return;
    setBusy(true); setError("");
    try {
      const payload = JSON.stringify({ question: text, version, ...context, selected_id: selected, previous_user_question: messages.at(-1)?.question || "" });
      if (pendingRequest.current?.payload !== payload) pendingRequest.current = { payload, id: crypto.randomUUID() };
      persist();
      const response = await fetch(`/api/rules/knowledge/games/${encodeURIComponent(gameId)}/editorial/ask${publicRead ? "?public=1" : ""}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...JSON.parse(payload), request_id: pendingRequest.current.id }) });
      const data = await response.json();
      // Unknown network outcomes retry the same request. A completed failure can be retried explicitly.
      if (response.status !== 409 && data.code !== "upstream_unavailable") pendingRequest.current = null;
      if (!response.ok) throw new Error(data.error || "無法回答");
      const answer = answerSchema.parse(data);
      setMessages(old => [...old, { question: text, answer, context: { ...context } }]);
      if (data.kind !== "clarification") { setQuestion(""); setSelected(""); } else setQuestion(text);
    } catch (e) { setError(e instanceof Error ? e.message : "問答服務暫時無法使用"); } finally { setBusy(false); }
  }
  const latest = messages.at(-1)?.answer;
  return <section className="card-euro mt-6 rounded-lg p-5" aria-label="規則問答">
    <h2 className="font-semibold">規則問答</h2><p className="mt-2 leading-7">說明你想確認的動作與情境，再從回答下方核對原文。</p>
    <details className="mt-2 text-sm"><summary className="min-h-11 cursor-pointer py-2">目前版本與對話保留方式</summary><p className="leading-7">回答以發布版 {version.slice(0, 10)} 為依據。{publicRead ? "對話保留於目前分頁，返回或重新整理可繼續；關閉分頁前請保存需要的答案。不同遊戲與版本分開保留。" : "此處對話只保留在本頁，重新整理後清除。"}</p></details>
    {publicRead && <p className="mt-2 text-sm leading-7">已保存答案只存於目前瀏覽器，不跨裝置同步。<Link className="knowledge-link inline-flex min-h-11 items-center underline" href="/knowledge/records">查看已保存答案</Link></p>}
    {!ready && <p role="status">正在恢復對話…</p>}
    {storageNotice && <p role="alert" className="my-3">{storageNotice}</p>}
    <details className="mt-3" open={contextOpen || Boolean(latest?.missing_context?.some(key => key !== "referent"))} onToggle={event => setContextOpen(event.currentTarget.open)}><summary className="min-h-11 cursor-pointer py-2 text-sm">補充角色、人數、擴充或階段（需要時填寫）</summary>
    <div className="my-3 grid gap-3 sm:grid-cols-2">{([["role", "角色"], ["players", "人數"], ["expansion", "擴充"]] as const).map(([key, field]) => <label key={key} className="text-sm">{field}{latest?.missing_context?.includes(key) && "（請補充）"}<select disabled={busy || !ready} className="input-euro mt-1 min-h-11 w-full" value={context[key]} onChange={e => setContext(old => ({ ...old, [key]: e.target.value }))}><option value="">尚未指定</option>{[...new Set(document.blocks.flatMap(b => ids(b.fields[field])))].filter(v => v !== "全部").map(v => <option key={v}>{v}</option>)}</select></label>)}
      <label className="text-sm">階段／時機<input disabled={busy} className="input-euro mt-1 min-h-11 w-full" value={context.stage} onChange={e => setContext(old => ({ ...old, stage: e.target.value }))} /></label>
    </div></details>
    {messages.map((message, i) => { const evidence = answerEvidence(document, message.answer); return <article key={i} className="answer-entry my-6 border-t border-grid-line pt-6" aria-label={`問答 ${i + 1}`}><h3 className="text-sm font-semibold">問題</h3><p className="mt-2 font-semibold leading-8">{message.question}</p><h3 className="mt-5 text-sm font-semibold">{message.answer.kind === "clarification" ? "請先補充" : "答案"}</h3><p className="mt-2 whitespace-pre-wrap leading-8">{message.answer.answer}</p>
      <AnswerReferences document={document} answer={message.answer} sourceHref={sourceHref} />
      <EditorialVisuals gameId={gameId} visuals={message.answer.visual_citations || []} publicRead={publicRead} onSelect={i === messages.length - 1 ? setSelected : undefined} />
      <details className="mt-3 text-sm"><summary className="min-h-11 cursor-pointer py-2">整理稿與引用識別資訊</summary>
      {message.answer.citations.map(id => { const block = document.blocks.find(b => b.id === id); return block && <details key={id} className="mt-2" open={expanded.includes(`${i}:${id}`)} onToggle={event => { const open = event.currentTarget.open; const key = `${i}:${id}`; setExpanded(old => open === old.includes(key) ? old : open ? [...old, key] : old.filter(value => value !== key)); }}><summary className="min-h-11 cursor-pointer text-brass underline">核對引用 {id}</summary><EditorialBlockCard block={block} />{sourceHref && pages(block.fields.PDF頁碼).map(page => <a key={page} className="mr-3 inline-flex min-h-11 items-center text-brass underline" href={sourceHref(page, block.id)}>看原文 · 第 {page} 頁</a>)}</details>; })}
      </details>
      {publicRead && <div className="mt-3 flex flex-wrap items-center gap-3">
        <button className="btn-euro min-h-11 rounded-lg px-3" disabled={!evidence.canReview || saveStates[i]?.busy || Boolean(saveStates[i]?.id)} onClick={() => { setReviewIndex(i); setReviews(old => old[i] ? old : { ...old, [i]: { question: `${document.blocks.find(block => block.kind === "文件")?.fields.遊戲 || gameId}：${message.question}`, confirmed: false } }); }}>{saveStates[i]?.busy ? "保存中…" : saveStates[i]?.id ? "已保存" : "保存答案"}</button>
        {saveStates[i]?.id && <Link className="knowledge-link inline-flex min-h-11 items-center underline" href={`/knowledge/records?id=${saveStates[i].id}`}>查看這筆紀錄</Link>}
        {saveStates[i]?.id && <span role="status" className="text-sm">已保存至目前瀏覽器</span>}
        {saveStates[i]?.error && <p role="alert" className="w-full text-sm">{saveStates[i].error}</p>}
      </div>}
      {publicRead && reviewIndex === i && <section className="mt-4 rounded-lg border border-grid-line p-4" aria-label="整理參考問答">
        <label className="block font-semibold">整理後的完整問題<textarea aria-label="整理後的完整問題" className="input-euro mt-2 min-h-28 w-full rounded-lg p-3" value={reviews[i]?.question || ""} maxLength={1000} onChange={event => setReviews(old => ({ ...old, [i]: { question: event.target.value, confirmed: false } }))} /></label>
        <p className="mt-2 text-sm leading-7">寫清楚動作、條件與判斷時點，讓問題離開這段對話仍能被理解。</p>
        <label className="mt-3 flex items-start gap-3 text-sm leading-7"><input type="checkbox" checked={reviews[i]?.confirmed || false} onChange={event => setReviews(old => ({ ...old, [i]: { ...old[i], confirmed: event.target.checked } }))} />問題已說清楚適用情境，且我已核對以上原文支持回答</label>
        <p className="mt-2 text-sm leading-7">這是你在本機核對的參考問答，不會發布為正式 FAQ。</p>
        <button className="btn-euro-primary mt-3 min-h-11 rounded-lg px-4" disabled={!reviews[i]?.confirmed || !reviews[i]?.question.trim() || !evidence.canReview || saveStates[i]?.busy} onClick={() => void saveAnswer(i)}>確認保存參考問答</button>
      </section>}
    </article>; })}
    {latest?.missing_context?.includes("referent") && <label className="my-3 block text-sm">選擇你指的規則或元件<select className="input-euro mt-1 min-h-11 w-full" value={selected} onChange={e => setSelected(e.target.value)}><option value="">請選擇，或在問題中補上名稱</option>{document.blocks.filter(b => ["規則", "圖片"].includes(b.kind) && b.fields.狀態 === "已確認").map(b => <option key={b.id} value={b.id}>{b.fields.名稱 || b.fields.標題} · {b.id}</option>)}</select></label>}
    {selected && <p role="status" className="text-sm">已選擇：{document.blocks.find(b => b.id === selected)?.fields.名稱 || selected}</p>}
    <label className="mt-4 block text-sm">問題或追問<textarea aria-label="問題或追問" maxLength={500} disabled={busy} className="input-euro mt-2 min-h-24 w-full rounded-lg p-3" value={question} placeholder={query || "說明要確認的動作、條件與時點…"} onChange={e => { setQuestion(e.target.value); setSelected(""); }} /></label>
    {error && <p role="alert" className="my-3 text-red-800">{error}</p>}
    <div className="mt-3 flex flex-wrap gap-3"><button disabled={!ready || busy || (question || query).trim().length < 2} onClick={() => void ask()} className="btn-euro-primary min-h-11 rounded-lg px-4 disabled:opacity-50">{busy ? "查詢中…" : "詢問"}</button><button disabled={!ready || busy || Object.values(saveStates).some(state => state.busy)} className="btn-euro min-h-11 rounded-lg px-4" onClick={() => { if (publicRead && (question || messages.length) && !window.confirm("清除目前分頁的這個版本對話？已保存答案會保留。")) return; setMessages([]); setSelected(""); setError(""); setQuestion(""); setSaveStates({}); setExpanded([]); setReviews({}); setReviewIndex(null); pendingRequest.current = null; }}>清除本頁對話</button></div>
  </section>;
}
