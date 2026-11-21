import { ids, pages, type EditorialBlock, type EditorialDocument } from "./editorial";
import { pdfPageLink } from "./editorial-reader";
import type { KnowledgeAnswer } from "./knowledge-records";

export type RuleEvidence = { block: EditorialBlock; quote: string; pages: number[]; sources: EditorialBlock[] };

/** Structural checks only. Whether the quote supports the answer still requires a reader's review. */
export function answerEvidence(document: EditorialDocument, answer: KnowledgeAnswer) {
  const entries: RuleEvidence[] = [], issues = new Set<string>(), visited = new Set<string>();
  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const block = document.blocks.find(item => item.id === id);
    if (!block) { issues.add("部分引用找不到對應條文"); return; }
    if (block.kind === "FAQ") {
      const references = ids(block.fields.引用 || "");
      if (!references.length) issues.add("FAQ 沒有連到原文條文");
      references.forEach(visit); return;
    }
    if (block.kind !== "規則") { issues.add("引用尚未提供規則原文"); return; }
    const quote = block.fields.原文?.trim() || "";
    if (!quote || /請填|請貼|未確認|^無$|^不適用$/.test(quote)) { issues.add("引用缺少可核對的原文，不能以整理內容代替"); return; }
    const pageNumbers = pages(block.fields.PDF頁碼 || "");
    if (!pageNumbers.length) issues.add("引用缺少 PDF 頁次");
    const sourceIds = ids(block.fields.來源 || "");
    const sources = sourceIds.flatMap(id => document.blocks.filter(item => item.id === id && item.kind === "來源"));
    if (!sourceIds.length || sources.length !== sourceIds.length) issues.add("引用缺少完整來源資料");
    for (const source of sources) {
      if (!source.fields.名稱?.trim() || !source.fields.版本?.trim()) issues.add("來源缺少名稱或版次");
      if (!pdfPageLink(source.fields.網址 || "", "")) issues.add("來源尚未提供可開啟的原頁連結");
      const total = Number(source.fields.PDF頁數);
      if (Number.isFinite(total) && total > 0 && pageNumbers.some(page => page > total)) issues.add("引用頁次超出來源範圍");
    }
    entries.push({ block, quote, pages: pageNumbers, sources });
  }
  if (!answer.citations.length) issues.add("回答尚未提供文字原文依據");
  answer.citations.forEach(visit);
  if (answer.kind === "clarification" || answer.missing_context?.length) issues.add("問題仍待補充情境，請先完成追問");
  if (!["faq", "ai", "cache", "visual"].includes(answer.kind) || (answer.resolution_status && /insufficient|unresolved|conflict|partial|missing/.test(answer.resolution_status))) issues.add("目前回答尚不能作為完整參考問答");
  if (!entries.length && !issues.size) issues.add("回答尚無可核對的原文");
  return { entries, issues: [...issues], canReview: entries.length > 0 && issues.size === 0 };
}
