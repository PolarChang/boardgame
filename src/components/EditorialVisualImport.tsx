"use client";
import { useEffect, useRef, useState } from "react";
import { parseEditorial, type EditorialBlock } from "@/lib/editorial";

export default function EditorialVisualImport({ gameId, password, text, onAppend }: { gameId: string; password: string; text: string; onAppend: (block: EditorialBlock) => boolean }) {
  const [source, setSource] = useState(""), [page, setPage] = useState(1), [bounds, setBounds] = useState("0,0,1,1");
  const [file, setFile] = useState<File | null>(null), [publicAllowed, setPublicAllowed] = useState(false), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const [pendingBlock, setPendingBlock] = useState<EditorialBlock | null>(null);
  const append = useRef(onAppend);
  useEffect(() => { append.current = onAppend; }, [onAppend]);
  function addBlock(block: EditorialBlock) {
    if (append.current(block)) { setPendingBlock(null); setNotice("已加入待確認圖片。請到校對工作區填寫名稱、替代文字、相關規則並核對來源。"); }
    else { setPendingBlock(block); setNotice("圖片已處理，但尚未加入草稿。請先儲存目前條目或排除保存問題，再按加入。"); }
  }
  async function upload() {
    if (!file) return;
    setBusy(true); setNotice("");
    try {
      if (file.size > 50_000_000) throw new Error("來源檔案不可超過 50 MB");
      const form = new FormData();
      if (file.size > 4_000_000) {
        const contentType = /\.pdf$/i.test(file.name) ? "application/pdf" : /\.png$/i.test(file.name) ? "image/png" : "image/jpeg";
        const signed = await fetch(`/api/rules/knowledge/games/${encodeURIComponent(gameId)}/editorial/visuals/upload-url`, { method: "POST", headers: { "Content-Type": "application/json", "X-Knowledge-Admin": password }, body: JSON.stringify({ content_type: contentType, size: file.size }) });
        const upload = await signed.json(); if (!signed.ok) throw new Error(upload.error || "無法取得上傳網址");
        const sent = await fetch(upload.upload_url, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
        if (!sent.ok) throw new Error("檔案直傳失敗，請稍後重試");
        form.set("object_name", upload.object_name);
      } else form.set("file", file);
      form.set("source_id", source); form.set("page", String(page)); form.set("bounds", JSON.stringify(bounds.split(",").map(Number))); form.set("public_allowed", String(publicAllowed));
      const response = await fetch(`/api/rules/knowledge/games/${encodeURIComponent(gameId)}/editorial/visuals/crop`, { method: "POST", headers: { "X-Knowledge-Admin": password }, body: form });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "圖片匯入失敗");
      addBlock(data.block);
    } catch (e) { setNotice(e instanceof Error ? e.message : "圖片匯入失敗"); } finally { setBusy(false); }
  }
  async function backup() {
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/rules/knowledge/games/${encodeURIComponent(gameId)}/editorial/visuals/export`, { method: "POST", headers: { "Content-Type": "application/json", "X-Knowledge-Admin": password }, body: JSON.stringify({ document: parseEditorial(text).document }) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "備份失敗"); }
      if (response.headers.get("Content-Type")?.includes("application/json")) { const data = await response.json(); window.location.assign(data.download_url); }
      else {
        const url = URL.createObjectURL(await response.blob()); const link = window.document.createElement("a"); link.href = url; link.download = "rules-v2.zip"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
      setNotice("完整備份包含稿件、裁切圖與原始來源，請妥善保存。");
    } catch (e) { setNotice(e instanceof Error ? e.message : "備份失敗"); } finally { setBusy(false); }
  }
  return <details className="card-euro my-5 rounded-lg p-5"><summary className="cursor-pointer font-semibold">加入原書圖示／元件圖片</summary><div className="mt-3 space-y-3">
    <p className="text-sm leading-7">上傳同版本 PDF、PNG 或 JPEG，裁切原圖後加入待校對稿。最多 50 MB、100 頁；不會生成新圖片。</p>
    <label className="block">來源檔案<input type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={busy} onChange={e => setFile(e.target.files?.[0] || null)} /></label>
    <label className="block">稿件來源編號<input className="input-euro ml-2 min-h-11" value={source} onChange={e => setSource(e.target.value)} placeholder="SRC-001" /></label>
    <label className="block">PDF 實際頁次<input type="number" min={1} max={100} value={page} className="input-euro ml-2 min-h-11" onChange={e => setPage(Number(e.target.value))} /></label>
    <label className="block">裁切範圍（左、上、右、下，0 到 1）<input className="input-euro mt-1 min-h-11 w-full" value={bounds} onChange={e => setBounds(e.target.value)} /></label>
    <label className="block text-sm"><input type="checkbox" checked={publicAllowed} onChange={e => setPublicAllowed(e.target.checked)} /> 我已核對來源的公開權限，允許這張裁切圖於確認發布後公開顯示</label>
    <button disabled={busy || !file || !password || !source} className="btn-euro min-h-11 rounded-lg px-3 disabled:opacity-50" onClick={() => void upload()}>{busy ? "處理圖片中…" : "上傳並加入待校對稿"}</button>
    {pendingBlock && <button disabled={busy} className="btn-euro min-h-11 rounded-lg px-3" onClick={() => addBlock(pendingBlock)}>將圖片加入目前草稿</button>}
    <p className="text-sm">Markdown 備份只含圖片引用，不含圖片檔案。含圖片的完整備份請下載 ZIP。</p><button disabled={busy || !password || !text} className="btn-euro min-h-11 rounded-lg px-3 disabled:opacity-50" onClick={() => void backup()}>下載完整 v2 圖文備份</button>
    {notice && <p role="status">{notice}</p>}
  </div></details>;
}
