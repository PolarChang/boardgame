"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import EditorialBlockCard from "@/components/EditorialBlockCard";
import AnswerReferences from "@/components/AnswerReferences";
import EditorialVisuals from "@/components/EditorialVisuals";
import { readKnowledgeRecords, type KnowledgeRecord } from "@/lib/knowledge-records";
import { pdfPageLink } from "@/lib/editorial-reader";
import "../knowledge.css";

export default function SavedAnswersPage() {
  const [records, setRecords] = useState<KnowledgeRecord[]>([]);
  const [ready, setReady] = useState(false), [error, setError] = useState("");
  const [invalid, setInvalid] = useState(0), [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState("");
  const [versionNotice, setVersionNotice] = useState("");
  const record = records.find(item => item.id === selected);
  useEffect(() => {
    const restore = () => setSelected(new URLSearchParams(window.location.search).get("id") || "");
    restore(); window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    function load() {
      try {
        const result = readKnowledgeRecords(localStorage);
        setRecords(result.records); setInvalid(result.invalid); setError("");
      } catch { setError("無法讀取已保存答案，請確認瀏覽器允許儲存後重試。原有紀錄不會被清除。"); }
      setReady(true);
    }
    load(); window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, [attempt]);
  useEffect(() => {
    if (!record) return;
    const controller = new AbortController();
    setVersionNotice("正在確認目前發布版本…");
    fetch(`/api/rules/knowledge/games/${encodeURIComponent(record.gameId)}/editorial?public=1`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (response.status === 404) return "目前沒有公開發布的規則；下方仍為原保存快照。";
        if (!response.ok) throw new Error("unavailable");
        const current = await response.json();
        if (typeof current.version !== "string") throw new Error("invalid version");
        return current.version === record.version ? "目前發布版本與保存時相同。" : "規則已更新。這筆答案仍使用原版本，請查看目前規則再決定是否適用。";
      })
      .then(notice => { if (!controller.signal.aborted) setVersionNotice(notice); })
      .catch(() => { if (!controller.signal.aborted) setVersionNotice("無法確認目前發布版本；下方仍可閱讀原保存快照。"); });
    return () => controller.abort();
  }, [record]);
  return <main className="knowledge-page mx-auto max-w-4xl px-4 py-8 sm:px-8">
    <Link className="knowledge-link inline-flex min-h-11 items-center underline" href="/knowledge">← 規則庫</Link>
    <h1 className="my-3 text-3xl font-semibold">已保存答案</h1>
    <p className="knowledge-muted leading-7">紀錄只存於目前瀏覽器，不跨裝置同步。清除網站資料會移除紀錄；網址本身不包含問題或答案。</p>
    {!ready ? <p role="status" className="my-5">正在讀取紀錄…</p> : error ? <div className="knowledge-error my-5 rounded-lg p-5"><p role="alert">{error}</p><button className="btn-euro mt-3 rounded-lg px-4" onClick={() => setAttempt(value => value + 1)}>重新讀取紀錄</button></div> : <>
      {invalid > 0 && <p role="alert" className="my-5">有 {invalid} 筆紀錄格式無法辨識，已保留原始資料，未覆寫或刪除。</p>}
      {selected && !record && <p role="status" className="my-5">這個瀏覽器找不到這筆紀錄。請從下方選擇已保存答案，或回到原本保存的瀏覽器。</p>}
      {record && <article className="knowledge-panel my-6 min-w-0 rounded-lg p-5 sm:p-6" aria-label="保存的答案">
        <h2 className="break-words text-xl font-semibold">{record.message.question}</h2>
        <p className="mt-2 text-sm leading-7">{record.review ? "本機參考問答：問題與原文支持已由保存者核對" : "舊紀錄：尚未依完整問題與原文支持的新標準核對"}</p>
        {versionNotice.startsWith("規則已更新") && <p role="status" className="mt-2 text-sm leading-7">{versionNotice}</p>}
        <h3 className="mt-4 font-semibold">答案</h3>
        <p className="mt-5 whitespace-pre-wrap break-words leading-8">{record.message.answer.answer}</p>
        <EditorialVisuals gameId={record.gameId} visuals={record.message.answer.visual_citations || []} publicRead />
        <AnswerReferences document={{ blocks: record.blocks }} answer={record.message.answer} />
        <details className="mt-4"><summary className="min-h-11 cursor-pointer py-2 text-sm">保存時的整理稿與來源資訊</summary>
        <p className="knowledge-muted mt-3 break-words text-sm leading-7">{record.gameName} · 保存於 {new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "short" }).format(record.savedAt)}</p>
        <details className="mt-2 text-sm"><summary className="min-h-11 cursor-pointer py-2">保存版本</summary><p className="break-all leading-7">原發布版本：{record.version}</p></details>
        <p className="knowledge-muted mt-2 text-sm leading-7">以下是保存當時的回答與引用文字，不會自動換成新版來源。原書外部連結的內容可能已更新。</p>
        {record.message.context && <p className="mt-2 text-sm leading-7">當時情境：{Object.entries(record.message.context).filter(([, value]) => value).map(([key, value]) => `${({ role: "角色", players: "人數", expansion: "擴充", stage: "階段" } as Record<string, string>)[key]}：${value}`).join("；") || "未指定"}</p>}
        <p className="knowledge-muted mt-3 text-sm">回答類型：{({ faq: "已確認 FAQ", clarification: "需要補充情境", ai: "AI 整理，請核對引用", cache: "同版本快取", visual: "已確認原書圖片" } as Record<string, string>)[record.message.answer.kind] || "目前無法裁定"}</p>
        {!versionNotice.startsWith("規則已更新") && <p role="status" className="mt-2 text-sm leading-7">{versionNotice}</p>}
        <h3 className="mt-6 font-semibold">保存當時的引用</h3>
        {!record.message.answer.citations.length && <p className="knowledge-muted mt-2 leading-7">此回答沒有文字引用，不能視為已核對原文。</p>}
        {[...new Set([...record.message.answer.citations, ...record.blocks.filter(block => block.kind === "規則").map(block => block.id)])].map(id => {
          const block = record.blocks.find(item => item.id === id);
          return <details key={id} className="mt-3"><summary className="min-h-11 cursor-pointer py-2">核對引用 {id}</summary>{block ? <EditorialBlockCard block={block} /> : <p>保存時未取得這筆引用文字。</p>}</details>;
        })}
        {record.blocks.filter(block => block.kind === "來源").map(source => {
          const link = pdfPageLink(source.fields.網址 || "", "");
          return <div key={source.id} className="mt-3 break-words text-sm leading-7"><p>{source.fields.名稱 || source.id} · 來源版本：{source.fields.版本 || "未提供"}</p>{link && <a className="knowledge-link inline-flex min-h-11 items-center underline" href={link.href} target="_blank" rel="noreferrer">開啟原書來源（新分頁）</a>}</div>;
        })}
        </details>
        <Link className="knowledge-link mt-4 inline-flex min-h-11 items-center underline" href={`/knowledge/${encodeURIComponent(record.gameId)}/reader`}>查看目前發布的規則</Link>
      </article>}
      {!records.length ? <div className="knowledge-empty my-6"><h2 className="font-semibold">還沒有保存答案</h2><p className="mt-2 leading-7">在規則問答的回答下方選擇「保存答案」，之後就能在這裡找回。</p><Link className="knowledge-link mt-3 inline-flex min-h-11 items-center underline" href="/knowledge">前往規則庫</Link></div> : <section className="my-6" aria-label="已保存答案清單"><h2 className="font-semibold">全部紀錄（{records.length}）</h2><ul className="mt-3 space-y-3">{records.map(item => <li key={item.id} className="min-w-0"><Link className="knowledge-panel block rounded-lg p-4 hover:underline" aria-current={selected === item.id ? "page" : undefined} href={`/knowledge/records?id=${item.id}`} onClick={() => setSelected(item.id)}><strong className="block break-words">{item.message.question}</strong><span className="knowledge-muted mt-2 block break-words text-sm">{item.gameName} · 版本 {item.version.slice(0, 10)}</span></Link></li>)}</ul></section>}
    </>}
  </main>;
}
