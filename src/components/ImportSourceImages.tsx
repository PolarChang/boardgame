"use client";

import { useEffect, useState } from "react";
import RuleImageViewer, { type RuleImage } from "./RuleImageViewer";

type Location = { kind: string; page: number; block: number };
type Source = { digest: string; locations: Location[] };

export default function ImportSourceImages({ base, initialPage = 1, totalPages, version = "" }: { base: string; initialPage?: number; totalPages?: number; version?: string }) {
  const [source, setSource] = useState<Source | null>(null);
  const [page, setPage] = useState(initialPage);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => { setPage(initialPage); }, [initialPage]);
  useEffect(() => {
    const controller = new AbortController();
    setSource(null); setError("");
    fetch(`${base}/locations`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "來源定位暫時無法讀取");
      if (!/^[a-f0-9]{64}$/.test(data.digest) || !Array.isArray(data.locations)) throw new Error("無法確認原件版本，請重新開啟文件");
      if (!controller.signal.aborted) setSource(data);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "來源讀取失敗"); });
    return () => controller.abort();
  }, [base, retry]);

  const validPage = Number.isSafeInteger(page) && page >= 1 && (!totalPages || page <= totalPages);
  const whole: RuleImage | undefined = source && validPage ? { id: `page-${page}`, label: "來源整頁", src: `${base}/pages/${page}/image?digest=${source.digest}`, alt: `來源 PDF 檔案第 ${page} 頁整頁原圖`, provenance: `PDF 檔案第 ${page} 頁 · 原件 ${source.digest.slice(0, 12)}${version ? ` · 閱讀快照 ${version.slice(0, 12)}` : ""} · 未加標註` } : undefined;
  const crops: RuleImage[] = source?.locations.filter(item => item.kind === "image" && item.page === page && Number.isSafeInteger(item.block) && item.block > 0).map(item => ({ id: `block-${item.block}`, label: `原圖區域 ${item.block}`, src: `${base}/pages/${page}/blocks/${item.block}/image`, alt: `來源 PDF 第 ${page} 頁已保存定位的圖片區域 ${item.block}`, provenance: `PDF 第 ${page} 頁 · 原件 ${source.digest.slice(0, 12)} · 原書裁切，非重繪；請核對附近文字與例外` })) || [];

  return <section className="knowledge-source-images my-5" aria-label="原書頁面">
    {totalPages && <div className="mb-4 flex flex-wrap items-center gap-3">
      <button type="button" className="btn-euro min-h-11 rounded-lg px-3" disabled={!validPage || page <= 1} onClick={() => setPage(page - 1)}>上一頁</button>
      <label className="text-sm">頁碼<input type="number" min={1} max={totalPages} value={page || ""} className="input-euro ml-2 min-h-11 w-16 rounded-lg px-2" onChange={event => setPage(Number(event.target.value))} /><span className="ml-2">／{totalPages}</span></label>
      <button type="button" className="btn-euro min-h-11 rounded-lg px-3" disabled={!validPage || page >= totalPages} onClick={() => setPage(page + 1)}>下一頁</button>
    </div>}
    {!validPage && <p role="alert">請輸入有效的 PDF 檔案頁次。</p>}
    {error ? <div role="alert" className="knowledge-error rounded-lg p-4"><p>{error}</p><button className="btn-euro mt-3 rounded-lg" type="button" onClick={() => setRetry(value => value + 1)}>重新讀取來源</button></div> : !source ? <p role="status">正在載入原書…</p> : whole && <>
      <RuleImageViewer key={`${source.digest}/${page}`} images={[whole, ...crops.slice(0, 12)]} caption={`原書第 ${page} 頁`} compact sourceHref={`${base}/source?inline=1#page=${page}`} />
    </>}
  </section>;
}
