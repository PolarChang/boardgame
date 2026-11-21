"use client";
import { useEffect, useState } from "react";
import { ids, pages, type EditorialBlock, type EditorialDocument } from "@/lib/editorial";
import { pdfPageLink } from "@/lib/editorial-reader";
export default function EditorialSources({ document, block }: { document: EditorialDocument; block: EditorialBlock }) {
  const [file, setFile] = useState<File | null>(null), [localUrl, setLocalUrl] = useState(""), [error, setError] = useState("");
  useEffect(() => { if (!file) return; const url = URL.createObjectURL(file); setLocalUrl(url); return () => URL.revokeObjectURL(url); }, [file]);
  const sources = document.blocks.filter(b => b.kind === "來源" && ids(block.fields.來源).includes(b.id));
  const page = pages(block.fields.PDF頁碼)[0];
  return <section aria-label="PDF 來源對照" className="my-4 rounded-lg border border-grid-line p-4"><h4 className="font-semibold">PDF 來源對照</h4><p className="my-2 text-sm">{block.fields.來源 || "未提供來源"} · PDF 頁碼：{block.fields.PDF頁碼 || "未提供"}</p>{sources.map(source => { const link = pdfPageLink(source.fields.網址 || "", block.fields.PDF頁碼); return <div key={source.id} className="my-3 break-words text-sm"><p>{source.fields.名稱 || source.id}</p>{link ? <a className="inline-flex min-h-11 items-center underline" href={link.href} target="_blank" rel="noreferrer">{link.page ? `開啟 PDF 第 ${link.page} 頁` : "開啟來源網站（需自行找頁）"} ↗</a> : <p>此來源尚未提供可用網址，可選取同版本本機 PDF。</p>}</div>; })}<label className="my-3 block text-sm">選取本機 PDF 對照<input type="file" accept="application/pdf,.pdf" className="mt-2 block w-full" onChange={e => { const next = e.target.files?.[0]; if (!next) return; if (!/\.pdf$/i.test(next.name) || next.size > 100_000_000) { setError("請選取小於 100 MB 的 PDF。"); return; } setError(""); setFile(next); }} /></label><p className="text-xs leading-6">檔案只在本頁開啟，不上傳、不寫入整理稿。請確認版本一致；PDF 檔案頁次可能與印刷頁碼不同。</p>{error && <p role="alert">{error}</p>}{localUrl && <a href={`${localUrl}${page ? `#page=${page}` : ""}`} target="_blank" rel="noreferrer" className="my-3 inline-flex min-h-11 items-center underline">{file?.name} · {page ? `開啟第 ${page} 頁` : "開啟 PDF"} ↗</a>}</section>;
}
