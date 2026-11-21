"use client";

import { useEffect, useMemo, useState } from "react";
import { editorialCategories, ids, pages, searchEditorial, type EditorialDocument } from "@/lib/editorial";
import { topics, topicOf } from "@/lib/editorial-topics";
import EditorialBlockCard from "./EditorialBlockCard";
import EditorialVisuals from "./EditorialVisuals";
import EditorialFlow from "./EditorialFlow";
import { entryFlowNodes } from "@/lib/editorial-flow";
import { ruleVisuals } from "@/lib/editorial-visuals";
import EditorialSources from "./EditorialSources";
import { entryPages, matchReasons, relatedEntries, sourcePageCount } from "@/lib/editorial-reader";

function excerpt(fields: Record<string, string>, query: string) {
  const term = query.trim().split(/\s+/).find(Boolean) || "";
  const passages = ["內容", "答案", "步驟", "條件", "成本", "結果", "限制", "例外"].map(key => fields[key]).filter(Boolean);
  const text = passages.find(value => term && value.toLowerCase().includes(term.toLowerCase())) || fields.內容 || fields.答案 || "";
  const index = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
  const start = Math.max(0, index - 35), end = Math.min(text.length, start + 150);
  return <>{start > 0 && "…"}{index >= 0 ? <>{text.slice(start, index)}<mark className="rounded bg-amber-200 text-stone-900">{text.slice(index, index + term.length)}</mark>{text.slice(index + term.length, end)}</> : text.slice(start, end)}{end < text.length && "…"}</>;
}

export default function EditorialDraftPreview({ document, gameId, published = false, version = "", onQuery, sourceHref }: { document: EditorialDocument; gameId?: string; published?: boolean; version?: string; onQuery?: (query: string) => void; sourceHref?: (page: number, blockId: string) => string }) {
  const [query, setQuery] = useState(""), [category, setCategory] = useState(""), [role, setRole] = useState(""), [players, setPlayers] = useState("");
  const [topic, setTopic] = useState(""), [expansion, setExpansion] = useState("");
  const [limit, setLimit] = useState(10);
  const [chapter, setChapter] = useState("");
  const [selected, setSelected] = useState("");
  const [view, setView] = useState("topics"), [source, setSource] = useState(""), [page, setPage] = useState("");
  const [flow, setFlow] = useState(""), [node, setNode] = useState("");
  const [ready, setReady] = useState(false);
  const trackLocation = Boolean(gameId || sourceHref);
  useEffect(() => { onQuery?.(query); }, [query, onQuery]);
  useEffect(() => {
    if (!trackLocation) return;
    const restore = () => { const p = new URLSearchParams(window.location.search); setView(["pages", "flow"].includes(p.get("view") || "") ? p.get("view")! : "topics"); setFlow(p.get("flow") || ""); setNode(p.get("node") || ""); setSource(p.get("source") || ""); setPage(p.get("page") || ""); setQuery(p.get("q") || ""); setCategory(p.get("category") || ""); setRole(p.get("role") || ""); setPlayers(p.get("players") || ""); setExpansion(p.get("expansion") || ""); setTopic(p.get("topic") || ""); setSelected(p.get("block") || ""); setReady(true); };
    restore(); window.addEventListener("popstate", restore); return () => window.removeEventListener("popstate", restore);
  }, [trackLocation]);
  useEffect(() => {
    if (!trackLocation || !ready) return;
    const url = new URL(window.location.href);
    Object.entries({ q: query, category, role, players, expansion, topic, view, source, page, flow, node, mode: published ? "published" : "draft", block: selected }).forEach(([key, value]) => { if (value) url.searchParams.set(key, value); else url.searchParams.delete(key); });
    window.history.replaceState(null, "", url);
  }, [trackLocation, ready, query, category, role, players, expansion, topic, selected, published, view, source, page, flow, node]);
  function openBlock(id: string) { if (trackLocation) { const url = new URL(window.location.href); url.searchParams.set("block", id); window.history.pushState(null, "", url); } setSelected(id); }
  const active = document.blocks.find(b => b.id === selected);
  const sources = document.blocks.filter(b => b.kind === "來源");
  const sourceId = sources.some(b => b.id === source) ? source : sources[0]?.id || "";
  const pageCount = sourcePageCount(sources.find(b => b.id === sourceId));
  const pageNumber = /^\d+$/.test(page) && Number(page) >= 1 && Number(page) <= pageCount ? Number(page) : 0;
  const coverage = document.blocks.filter(b => b.kind === "涵蓋" && ids(b.fields.來源).includes(sourceId) && pages(b.fields.PDF頁碼).includes(pageNumber));
  const flows = document.blocks.filter(b => b.kind === "流程");
  const flowId = flows.some(f => f.id === flow) ? flow : flows[0]?.id || "";
  const nodeId = node === "unassigned" || document.blocks.some(b => b.kind === "流程節點" && b.fields.流程 === flowId && b.id === node) ? node : "";
  const results = useMemo(() => {
    const matches = searchEditorial(document, query, category, role, players, expansion).filter(b => !chapter || document.chapters?.find(c => c.id === chapter)?.rule_ids.includes(b.id)).filter(b => !topic || (document.categories
      ? document.categories.find(c => c.id === topic)?.rule_ids.includes(b.id)
      : topicOf(b, document) === topic));
    if (view === "flow" && flowId) {
      return matches.map(block => ({block, nodes: entryFlowNodes(document, block, flowId)}))
        .filter(item => !nodeId || (nodeId === "unassigned" ? !item.nodes.length : item.nodes.some(n => n.id === nodeId)))
        .sort((a, b) => (Number(a.nodes[0]?.fields.順序 ?? 10001)) - (Number(b.nodes[0]?.fields.順序 ?? 10001)))
        .map(item => item.block);
    }
    if (view !== "pages") return matches;
    return matches.filter(b => { const span = entryPages(document, b, sourceId); return pageNumber ? span.includes(pageNumber) : span.length > 0; })
      .sort((a, b) => entryPages(document, a, sourceId)[0] - entryPages(document, b, sourceId)[0]);
  }, [document, query, category, role, players, expansion, topic, view, sourceId, pageNumber, flowId, nodeId, chapter]);
  const roles = [...new Set(document.blocks.filter(b => ["規則", "FAQ"].includes(b.kind)).flatMap(b => ids(b.fields.角色)))].filter(r => r !== "全部");
  const suggestions = [...new Set(document.blocks.filter(b => b.kind === "術語").flatMap(b => [b.fields.中文?.replace(/\s*[（(]暫定譯名[)）]/g, ""), b.fields.原文, ...ids(b.fields.別名)]).filter((term): term is string => !!term && term.length > 1 && !["未確認", "不適用", "無"].includes(term) && query.toLowerCase().includes(term.toLowerCase()) && term.toLowerCase() !== query.toLowerCase()))].slice(0, 6);
  const browseControls = <>
    {!!document.chapters?.length && <label className="my-3 block text-sm">原書章節<select className="input-euro ml-3 min-h-11 rounded-lg px-3" value={chapter} onChange={e => { setChapter(e.target.value); setLimit(10); setSelected(""); }}><option value="">全部章節</option>{document.chapters.map(c => <option key={c.id} value={c.id}>{c.parent_id ? "↳ " : ""}{c.title} · PDF {c.page} 頁</option>)}</select></label>}
    <nav aria-label="閱讀方式" className="my-4 flex flex-wrap gap-2">
      {[{ value: "topics", label: "按主題查找" }, { value: "pages", label: sourceHref ? "按頁碼找條目" : "按頁碼閱讀" }, { value: "flow", label: "按流程閱讀" }].map(item => <button key={item.value} aria-pressed={view === item.value} className={`min-h-11 rounded-lg border px-4 ${view === item.value ? "border-brass bg-brass/10" : "border-grid-line"}`} onClick={() => { setView(item.value); setLimit(10); }}>{item.label}</button>)}
    </nav>
  </>;
  return <section className="card-euro my-5 rounded-lg p-4 sm:p-5" aria-label="規則查找">
    {!sourceHref && <h2 className="text-lg font-semibold">{published ? "查找正式規則" : "查找本機草稿"}</h2>}
    {sourceHref ? <details className="mb-3"><summary className="min-h-11 cursor-pointer py-3 text-sm">瀏覽方式與章節</summary>{browseControls}</details> : browseControls}
    {view === "flow" && <EditorialFlow document={document} flowId={flowId} nodeId={nodeId} onFlow={id => { setFlow(id); setNode(""); setLimit(10); }} onNode={id => { setNode(id); setLimit(10); }} onRule={openBlock} />}
    {active && !results.some(b => b.id === active.id) && <p className="my-3 rounded-lg border border-brass p-3 text-sm leading-7">目前保留閱讀 {active.id}「{active.fields.標題 || active.fields.問題}」，此條目不在目前篩選結果中。返回結果後可選擇符合條件的條目。</p>}
    {view === "pages" && <section aria-label="來源頁碼" className="my-4 rounded-lg border border-grid-line p-4">
      <p className="mb-3 text-sm leading-7">頁次從 PDF 第一張起算。跨頁規則會出現在每個引用頁；FAQ 依引用規則定位。搜尋與篩選仍會套用。</p>
      {sources.length ? <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">閱讀來源<select className="input-euro mt-1 min-h-11 w-full rounded-lg px-3" value={sourceId} onChange={e => { setSource(e.target.value); setPage(""); setLimit(10); }} >{sources.map(b => <option key={b.id} value={b.id}>{b.fields.名稱 || b.id} · {b.id}</option>)}</select></label><label className="text-sm">PDF 實際頁次<select className="input-euro mt-1 min-h-11 w-full rounded-lg px-3" value={pageNumber || ""} onChange={e => { setPage(e.target.value); setLimit(10); }}><option value="">全部已引用頁面</option>{Array.from({length: pageCount}, (_, i) => <option key={i + 1} value={i + 1}>第 {i + 1} 頁</option>)}</select></label></div> : <p>尚未提供來源，請切回主題查找閱讀條目。</p>}
      {!!pageNumber && <div className="mt-3 text-sm leading-7"><h3 className="font-semibold">第 {pageNumber} 頁涵蓋紀錄</h3>{coverage.length ? coverage.map(b => <p key={b.id}>{b.fields.章節} · {b.fields.狀態 || "待確認"}：{b.fields.說明 || "未填寫說明"}</p>) : <p>此頁尚無涵蓋紀錄，不能據此判定沒有規則。</p>}</div>}
      <p className="mt-3 text-xs leading-6">未提供此來源頁碼的條目不列入頁碼結果，可切回主題查找。未提供有效 PDF 總頁數時，只能顯示已引用頁面。</p>
      {active && <p className="mt-3 text-sm">目前仍開啟 {active.id}；切換頁碼不會關閉正在閱讀的條目。</p>}
    </section>}
    <div className={active ? "hidden lg:block" : ""}>
    <label className="mt-4 block text-sm font-semibold">搜尋規則或 FAQ<input type="search" className="input-euro mt-2 min-h-11 w-full rounded-lg px-3" value={query} onChange={e => { setQuery(e.target.value); setLimit(10); setSelected(""); }} placeholder="例如：示威、貸款、RULE-018" /></label>
    <nav aria-label="規則主題" className="mt-4 flex flex-wrap gap-2">{[{id: "", name: "全部主題"}, ...(document.categories ?? topics.map(t => ({id: t, name: t})))].map(t => <button key={t.id} aria-pressed={topic === t.id} className={`min-h-11 rounded-lg border px-3 text-sm ${topic === t.id ? "border-brass bg-brass/10" : "border-grid-line"}`} onClick={() => { setTopic(t.id); setLimit(10); setSelected(""); }}>{t.name}{document.categories && t.id ? `（${document.categories.find(c => c.id === t.id)?.rule_ids.length ?? 0}）` : ""}</button>)}</nav>
    {topic && document.categories && <p className="mt-3 text-sm">相關標題：{[...new Set(document.categories.find(c => c.id === topic)?.assignments?.flatMap(a => a.titles) ?? [])].join("、") || "尚無可辨識標題"}。分類供導覽使用，仍請對照原文。</p>}
    <details className="mt-3 rounded-lg border border-grid-line p-3"><summary className="min-h-11 cursor-pointer">更多篩選條件</summary><p className="text-xs text-ink-light">可用空格分開關鍵字，結果須同時符合。</p><div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-sm">規則大項<select className="input-euro mt-1 min-h-11 w-full rounded-lg px-3" value={category} onChange={e => { setCategory(e.target.value); setLimit(10); setSelected(""); }}><option value="">全部大項</option>{editorialCategories.map(c => <option key={c}>{c}</option>)}</select></label>
      <label className="text-sm">適用角色<select className="input-euro mt-1 min-h-11 w-full rounded-lg px-3" value={role} onChange={e => { setRole(e.target.value); setLimit(10); setSelected(""); }}><option value="">全部角色</option>{roles.map(r => <option key={r}>{r}</option>)}</select></label>
      <label className="text-sm">遊戲人數<select className="input-euro mt-1 min-h-11 w-full rounded-lg px-3" value={players} onChange={e => { setPlayers(e.target.value); setLimit(10); setSelected(""); }}><option value="">全部人數</option>{[...new Set(document.blocks.flatMap(b => ids(b.fields.人數)))].filter(n => n !== "全部").map(n => <option key={n}>{n}</option>)}</select></label>
      <label className="text-sm">擴充<select className="input-euro mt-1 min-h-11 w-full rounded-lg px-3" value={expansion} onChange={e => { setExpansion(e.target.value); setSelected(""); }}><option value="">全部擴充</option>{[...new Set(document.blocks.flatMap(b => ids(b.fields.擴充)))].filter(v => v !== "全部").map(v => <option key={v}>{v}</option>)}</select></label>
    </div></details>
    <div className="my-3 flex flex-wrap gap-2" aria-label="作用中的篩選">{[{label:"搜尋",value:query,set:setQuery},{label:"主題",value:topic,set:setTopic},{label:"角色",value:role,set:setRole},{label:"大項",value:category,set:setCategory},{label:"人數",value:players,set:setPlayers},{label:"擴充",value:expansion,set:setExpansion}].filter(item => item.value).map(item => <button key={item.label} className="btn-euro min-h-11 rounded-lg px-3" onClick={() => { item.set(""); setSelected(""); }}>{item.label}：{item.label === "主題" ? document.categories?.find(c => c.id === item.value)?.name ?? item.value : item.value} ×</button>)}</div>
    <p role="status" className="my-4 text-sm">找到 {results.length} 筆條目，顯示前 {Math.min(limit, results.length)} 筆。</p>
    {(query || category || role || players || expansion || topic || chapter) && <button className="btn-euro mb-4 min-h-11 rounded-lg" onClick={() => { setQuery(""); setCategory(""); setRole(""); setPlayers(""); setExpansion(""); setTopic(""); setChapter(""); setLimit(10); setSelected(""); }}>清除搜尋與篩選</button>}
    {!results.length && <div className="rounded-lg border border-grid-line p-5"><h4 className="font-semibold">沒有符合的條目</h4><p className="mt-2 text-sm leading-7 text-ink-light">{view === "pages" ? "此來源／頁次沒有符合條件的條目。請查看涵蓋紀錄、切換頁次，或清除搜尋篩選。" : view === "flow" ? "此步驟沒有符合條件的條目。可切回全部步驟、查看尚未編入的條目，或清除搜尋篩選。" : "試試較短的完整詞語，或清除主題、角色與人數限制。"}</p></div>}
    {!results.length && suggestions.length > 0 && <div className="my-4"><p className="text-sm">問題中找到以下既有術語，可改用術語查找相關條文（不是此問題的裁定）：</p><div className="mt-2 flex flex-wrap gap-2">{suggestions.map(term => <button key={term} className="btn-euro min-h-11 rounded-lg px-3" onClick={() => { setQuery(term); setSelected(""); }}>{term}</button>)}</div></div>}
    </div>
    <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)]">
      <div className={`${active ? "hidden lg:block" : ""} space-y-2`} aria-label="搜尋結果">{results.slice(0, limit).map(block => <button key={block.id} aria-pressed={selected === block.id} className={`block w-full rounded-lg border p-4 text-left ${selected === block.id ? "border-brass bg-brass/10" : "border-grid-line"}`} onClick={() => openBlock(block.id)}><span className="text-xs text-ink-light">{block.kind} · {block.id} · {block.fields.狀態 || "待確認"}{view === "pages" && ` · PDF ${entryPages(document, block, sourceId).join("、")} 頁`}</span><span className="my-2 block font-semibold">{block.fields.標題 || block.fields.問題}</span>{query && <span className="my-2 block text-xs leading-6 text-ink-light">命中：{matchReasons(document, block, query).map(r => `${r.field}「${r.term}」${r.alias ? `（${r.alias}的別名）` : ""}`).join("；")}</span>}<span className="line-clamp-3 block text-sm leading-7">{excerpt(block.fields, query)}</span><span className="mt-2 block text-xs text-ink-light">{[block.fields.角色, block.fields.人數].filter(Boolean).join(" · ")}</span></button>)}</div>
      <div className="min-w-0">{active ? <><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><button className="btn-euro min-h-11 rounded-lg px-3" onClick={() => setSelected("")}>← 返回搜尋結果</button>{gameId && !sourceHref && <a className="btn-euro min-h-11 rounded-lg px-3 py-3" href={`/knowledge/${encodeURIComponent(gameId)}/manage?block=${encodeURIComponent(active.id)}&returnTo=${encodeURIComponent(`/knowledge/${encodeURIComponent(gameId)}/reader?${new URLSearchParams({ q: query, category, role, players, expansion, topic, view, flow: flowId, node: nodeId, source: sourceId, page: String(pageNumber || ""), mode: published ? "published" : "draft", block: active.id })}`)}`}>校對此條</a>}</div><EditorialBlockCard block={active} />{gameId && published && <EditorialVisuals gameId={gameId} visuals={ruleVisuals(document, active.id, version)} publicRead={Boolean(sourceHref)} />}{sourceHref && pages(active.fields.PDF頁碼).length ? <nav aria-label="原書頁碼" className="my-3 flex flex-wrap gap-x-4">{pages(active.fields.PDF頁碼).map(page => <a key={page} className="inline-flex min-h-11 items-center text-brass underline" href={sourceHref(page, active.id)}>看原文 · 第 {page} 頁</a>)}</nav> : !sourceHref && <EditorialSources key={active.fields.來源} document={document} block={active} />}<section className="my-4" aria-label="相關條目"><h4 className="font-semibold">相關規則與 FAQ</h4><p className="my-2 text-xs">以下依原稿引用連結，適用角色與待確認狀態各自保留。</p>{relatedEntries(document, active).map(b => <div key={b.id} className="my-3 rounded-lg border border-grid-line p-3"><button className="min-h-11 text-left font-semibold underline" onClick={() => openBlock(b.id)}>{b.id} · {b.fields.標題 || b.fields.問題}</button><p className="my-2 text-xs">{b.fields.角色 || "角色未提供"} · {b.fields.狀態 || "待確認"}</p>{b.kind === "FAQ" ? <p className="whitespace-pre-wrap text-sm leading-7">{b.fields.答案}</p> : <details><summary className="min-h-11 cursor-pointer text-sm">展開規則摘要</summary><p className="whitespace-pre-wrap text-sm leading-7">{(b.fields.內容 || "").slice(0,160)}{(b.fields.內容 || "").length > 160 ? "…" : ""}</p></details>}</div>)}{!relatedEntries(document, active).length && <p className="text-sm">此條目尚未列出相關引用。</p>}</section></> : <p className="hidden rounded-lg border border-grid-line p-6 text-sm leading-7 lg:block">選擇左側條目，閱讀完整內容、限制與例外。</p>}</div>
    </div>
    {results.length > limit && <button className="btn-euro mt-4 min-h-11 rounded-lg" onClick={() => setLimit(limit + 10)}>再顯示 10 筆</button>}
  </section>;
}
