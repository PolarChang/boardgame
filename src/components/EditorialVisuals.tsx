"use client";
import type { VisualCitation } from "@/lib/editorial-visuals";
import RuleImageViewer from "./RuleImageViewer";

export default function EditorialVisuals({ gameId, visuals, onSelect, publicRead = false }: { gameId: string; visuals: VisualCitation[]; onSelect?: (id: string) => void; publicRead?: boolean }) {
  if (!visuals.length) return null;
  return <section aria-label="原書元件圖片" className="my-4 grid gap-4 sm:grid-cols-2">{visuals.map(v => {
    const src = `/api/rules/knowledge/games/${encodeURIComponent(gameId)}/editorial/visuals/${encodeURIComponent(v.asset_id)}?version=${encodeURIComponent(v.version)}${publicRead ? "&public=1" : ""}`;
    return <div key={`${v.asset_id}/${v.version}`} className="min-w-0">
      <RuleImageViewer caption={v.caption} images={[{ id: v.asset_id, label: "已確認原圖", src, alt: v.alt, provenance: `${v.source_id} · PDF 第 ${v.page} 頁 · 發布版本 ${v.version.slice(0, 12)} · 已確認的公開原書裁切` }]} />
      {onSelect && <button className="btn-euro mt-2 min-h-11 rounded-lg px-3" onClick={() => onSelect(v.block_id)}>選擇 {v.caption}</button>}
    </div>;
  })}</section>;
}
