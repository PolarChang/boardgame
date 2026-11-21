"use client";

import { useEffect, useRef, useState } from "react";
import { Expand, Minus, Plus, X } from "lucide-react";

export type RuleImage = { id: string; label: string; src: string; alt: string; provenance: string };

function SourceImage({ image, width = 100, onOpen }: { image: RuleImage; width?: number; onOpen?: () => void }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (failed) return <div className="rule-image-error" role="alert"><p>圖片目前無法載入。請確認登入、來源版本或稍後重試。</p><button type="button" onClick={() => { setFailed(false); setLoaded(false); setAttempt(value => value + 1); }}>重新載入圖片</button></div>;
  const picture = <>
    {/* Same-origin private source images must bypass the public image optimizer. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img key={attempt} src={image.src} alt={image.alt} loading="lazy" decoding="async" style={{ width: `${width}%`, maxWidth: "none" }} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
  </>;
  return <>{!loaded && <p role="status" className="rule-image-loading">正在載入原圖…</p>}{onOpen ? <button type="button" className="rule-image-preview" aria-label={`放大 ${image.alt}`} onClick={onOpen}>{picture}</button> : picture}</>;
}

export default function RuleImageViewer({ images, caption, sourceHref, compact = false }: { images: RuleImage[]; caption: string; sourceHref?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const [zoom, setZoom] = useState(100);
  const dialog = useRef<HTMLDialogElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const image = images[selected] || images[0];

  useEffect(() => {
    if (!open || !dialog.current) return;
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const scroll = window.scrollY;
    const previousOverflow = document.body.style.overflow;
    const element = dialog.current;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      if (element.open) element.close();
      document.body.style.overflow = previousOverflow;
      focused?.focus({ preventScroll: true });
      if (window.scrollY !== scroll) window.scrollTo(0, scroll);
    };
  }, [open]);

  useEffect(() => { scroller.current?.scrollTo?.(0, 0); }, [selected]);
  if (!image) return null;
  return <figure className="rule-image-figure">
    <div className="rule-image-heading"><span>原書圖片</span><button type="button" onClick={() => { setSelected(0); setZoom(100); setOpen(true); }}><Expand size={16} aria-hidden="true" />{compact ? "放大" : "放大與核對來源"}</button></div>
    <SourceImage key={images[0].src} image={images[0]} onOpen={() => { setSelected(0); setZoom(100); setOpen(true); }} />
    <figcaption><strong>{caption}</strong>{!compact && <><span>{images[0].provenance}</span><span>原書內容；閱讀說明與條文請一起核對。PDF 檔案頁次可能不同於印刷頁碼。</span></>}</figcaption>
    {open && <dialog ref={dialog} className="rule-image-dialog" aria-label={`${caption} · 原圖檢視`} onClose={() => setOpen(false)}>
      <header><strong>{caption}</strong><button type="button" aria-label="關閉原圖，返回閱讀" onClick={() => setOpen(false)}><X size={19} aria-hidden="true" />返回閱讀</button></header>
      <div className="rule-image-toolbar">
        <div role="group" aria-label="圖片範圍">{images.map((item, index) => <button type="button" key={item.id} aria-pressed={selected === index} onClick={() => { setSelected(index); setZoom(100); }}>{item.label}</button>)}</div>
        <div role="group" aria-label="圖片縮放"><button type="button" disabled={zoom <= 100} aria-label="縮小圖片" onClick={() => setZoom(value => Math.max(100, value - 50))}><Minus size={18} /></button><output aria-live="polite">{zoom}%</output><button type="button" disabled={zoom >= 300} aria-label="放大圖片" onClick={() => setZoom(value => Math.min(300, value + 50))}><Plus size={18} /></button></div>
      </div>
      <p className="rule-image-provenance">{image.provenance}</p>
      <div ref={scroller} className="rule-image-scroller" tabIndex={0} role="region" aria-label="原圖捲動區"><SourceImage key={image.src} image={image} width={zoom} /></div>
      <footer><span>放大後可上下、左右滑動；關閉後回到原本位置。</span>{sourceHref && <a href={sourceHref} target="_blank" rel="noopener noreferrer">開啟來源 PDF ↗</a>}</footer>
    </dialog>}
  </figure>;
}
