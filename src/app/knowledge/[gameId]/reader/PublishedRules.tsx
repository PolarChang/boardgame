"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import EditorialCommunity from "@/components/EditorialCommunity";
import EditorialDraftPreview from "@/components/EditorialDraftPreview";
import EditorialConversation from "@/components/EditorialConversation";
import { ids, type EditorialDocument } from "@/lib/editorial";
import { pdfPageLink } from "@/lib/editorial-reader";
import "../../knowledge.css";

type View = "rules" | "source" | "questions" | "community";
type Release = { document: EditorialDocument | null; version: string };
const titles = { rules: "查規則", source: "看原書", questions: "問規則", community: "規則討論" };

export default function PublishedRules({ view }: { view: View }) {
  const { gameId } = useParams<{ gameId: string }>();
  return <PublishedRulesContent key={gameId} gameId={gameId} view={view} />;
}

function PublishedRulesContent({ gameId, view }: { gameId: string; view: View }) {
  const [release, setRelease] = useState<Release | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [source, setSource] = useState({ block: "", page: "", version: "" });
  const [resumeNotice, setResumeNotice] = useState("");
  const restoreY = useRef<number | null>(null);
  const [readingSearch, setReadingSearch] = useState("");
  const base = `/knowledge/${encodeURIComponent(gameId)}/reader`;
  const positionKey = useCallback((version: string, target: View) => `knowledge-reading:v1:${JSON.stringify([gameId, version, target])}`, [gameId]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setLibraryQuery(params.get("library") || "");
    setSource({ block: params.get("block") || "", page: params.get("page") || "", version: params.get("version") || "" });
    const controller = new AbortController();
    setError("");
    setRelease(null);
    fetch(`/api/rules/knowledge/games/${encodeURIComponent(gameId)}/editorial?public=1`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (response.status === 404) return { document: null, version: "" };
        if (!response.ok) throw new Error("暫時無法載入規則。");
        return response.json();
      })
      .then(data => {
        if (controller.signal.aborted) return;
        try {
          const saved = JSON.parse(sessionStorage.getItem(positionKey(data.version, view)) || "null");
          const reading = JSON.parse(sessionStorage.getItem(positionKey(data.version, "rules")) || "null");
          if (typeof reading?.search === "string") setReadingSearch(reading.search);
          const url = new URL(window.location.href);
          const explicit = [...url.searchParams.keys()].some(key => key !== "library");
          if (typeof saved?.search === "string" && Number.isFinite(saved.y) && saved.y >= 0) {
            const params = new URLSearchParams(saved.search);
            params.delete("library");
            const current = new URLSearchParams(url.search); current.delete("library");
            params.sort(); current.sort();
            if (!explicit || params.toString() === current.toString()) {
              if (url.searchParams.has("library")) params.set("library", url.searchParams.get("library")!);
              url.search = params.toString();
              window.history.replaceState(window.history.state, "", url);
              restoreY.current = saved.y;
            }
          }
          const current = new URLSearchParams(window.location.search);
          setSource({ block: current.get("block") || "", page: current.get("page") || "", version: current.get("version") || "" });
        } catch { setResumeNotice("瀏覽器無法恢復閱讀位置，仍可正常閱讀。"); }
        setRelease(data);
      })
      .catch(() => { if (!controller.signal.aborted) setError("暫時無法載入規則。"); });
    return () => controller.abort();
  }, [gameId, attempt, view, positionKey]);
  useEffect(() => {
    if (!release?.document) return;
    const key = positionKey(release.version, view);
    let frame = 0;
    const remember = () => {
      if (window.location.pathname !== (view === "rules" ? base : `${base}/${view}`)) return;
      try { sessionStorage.setItem(key, JSON.stringify({ search: window.location.search, y: window.scrollY })); }
      catch { setResumeNotice("瀏覽器無法保留閱讀位置，離頁後可能需要重新定位。"); }
    };
    const onScroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(remember); };
    const onClick = (event: MouseEvent) => { if ((event.target as Element)?.closest?.("a")) remember(); };
    const restored = restoreY.current;
    restoreY.current = null;
    if (restored !== null) frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => window.scrollTo({ top: restored, behavior: "instant" })); });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("click", onClick, true);
    window.addEventListener("pagehide", remember);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", onScroll); window.removeEventListener("click", onClick, true); window.removeEventListener("pagehide", remember); };
  }, [release, view, base, positionKey]);
  const libraryHref = libraryQuery ? `/knowledge?${new URLSearchParams({ q: libraryQuery })}` : "/knowledge";
  function viewHref(target: View) {
    const path = target === "rules" ? base : `${base}/${target}`;
    const params = new URLSearchParams(target === "rules" ? readingSearch : "");
    params.delete("library");
    if (libraryQuery) params.set("library", libraryQuery);
    return params.size ? `${path}?${params}` : path;
  }
  const document = release?.document;
  const title = document?.blocks.find(block => block.kind === "文件")?.fields.遊戲;
  const block = source.block ? document?.blocks.find(item => item.id === source.block) : undefined;
  const sources = document?.blocks.filter(item => item.kind === "來源" && (!source.block || (block && ids(block.fields.來源).includes(item.id)))) || [];
  function sourceLink(page: number, blockId: string) {
    return base + "/source?" + new URLSearchParams({ page: String(page), block: blockId, version: release?.version || "", ...(libraryQuery ? { library: libraryQuery } : {}) });
  }
  return <main className="knowledge-page mx-auto max-w-6xl px-4 py-6 sm:px-8">
    <Link className="knowledge-link inline-flex min-h-11 items-center underline" href={view === "rules" ? libraryHref : viewHref("rules")}>{view === "rules" ? "← 規則庫" : "← 查規則"}</Link>
    <h1 className="my-3 text-3xl font-bold">{view === "rules" ? title || titles.rules : titles[view]}</h1>
    {resumeNotice && <p role="status" className="my-3 text-sm">{resumeNotice}</p>}
    {view !== "rules" && title && <p className="text-sm text-ink-light">{title}</p>}
    {error ? <div className="knowledge-panel knowledge-error my-5 rounded-lg p-5"><p role="alert">{error} 請檢查連線後重試。</p><button className="btn-euro mt-3 rounded-lg px-4" onClick={() => setAttempt(value => value + 1)}>重新載入規則</button></div> : !release ? <p role="status">正在載入規則…</p> : !document ? <div className="knowledge-empty my-5"><h2 className="font-semibold">規則尚未發布</h2><p className="mt-2 leading-7">目前沒有可閱讀的正式版，請返回規則庫選擇其他遊戲。</p><Link className="knowledge-link mt-3 inline-flex min-h-11 items-center underline" href={libraryHref}>返回規則庫</Link></div> : <>
      <div className="knowledge-reader-context">
        <p className="text-sm leading-7">目前範圍：{title || "這款遊戲"} · 已發布版本 <span className="knowledge-version" title={release.version}>{release.version.slice(0, 10) || "未提供"}</span></p>
        <p className="knowledge-muted text-sm leading-7">閱讀與查來源不會送出問題；需要解釋時，再切換到「問規則」。</p>
      </div>
      <nav className="knowledge-reader-navigation" aria-label="規則工具">
        {(Object.keys(titles) as View[]).map(target => <Link key={target} href={viewHref(target)} aria-current={view === target ? "page" : undefined}>{titles[target]}</Link>)}
      </nav>
      <Link className="knowledge-link inline-flex min-h-11 items-center text-sm underline" href="/knowledge/records">已保存答案</Link>
      {view === "rules" && <>
        <EditorialDraftPreview document={document} gameId={gameId} published version={release.version} sourceHref={sourceLink} />
      </>}
      {view === "questions" && <EditorialConversation gameId={gameId} version={release.version} document={document} query="" publicRead sourceHref={sourceLink} />}
      {view === "community" && <EditorialCommunity gameId={gameId} publicRead />}
      {view === "source" && (source.version && source.version !== release.version
        ? <p role="status">規則已更新。請回到「查規則」重新開啟原文。</p>
        : sources.length ? <ul className="my-5 space-y-3">{sources.map(item => {
          const link = pdfPageLink(item.fields.網址 || "", source.page);
          return <li key={item.id} className="card-euro rounded-lg p-4">
            <p className="font-semibold">{item.fields.名稱 || "規則書"}</p>
            {link ? <a className="inline-flex min-h-11 items-center text-brass underline" href={link.href} target="_blank" rel="noreferrer">{link.page ? `開啟 PDF 第 ${link.page} 頁 ↗` : "開啟原書來源 ↗"}</a> : <p className="text-sm">這份原書尚未提供公開連結。</p>}
          </li>;
        })}</ul> : <p role="status">這份規則尚未提供公開原書。</p>)}
    </>}
  </main>;
}
