import type { EditorialDocument } from "./editorial";
import { ids } from "./editorial";

export type VisualCitation = { asset_id: string; block_id: string; version: string; source_id: string; page: number; caption: string; alt: string };
export function ruleVisuals(document: EditorialDocument, ruleId: string, version: string): VisualCitation[] {
  return document.blocks.filter(b => b.kind === "圖片" && b.fields.狀態 === "已確認" && b.fields.公開 === "是" && ids(b.fields.相關規則).includes(ruleId) && /^[a-f0-9]{64}$/.test(b.fields.資產 || ""))
    .sort((a, b) => Number(a.fields.順序 || 0) - Number(b.fields.順序 || 0))
    .map(b => ({ asset_id: b.fields.資產, block_id: b.id, version, source_id: b.fields.來源, page: Number(b.fields.PDF頁碼), caption: b.fields.名稱, alt: b.fields.替代文字 }));
}
