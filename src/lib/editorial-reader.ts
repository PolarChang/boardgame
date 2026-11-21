import { ids, pages, type EditorialBlock, type EditorialDocument } from "./editorial";
const normalize = (value: string) => value.normalize("NFKC").toLowerCase().trim();
export function matchReasons(doc: EditorialDocument, block: EditorialBlock, query: string) {
  const terms = [query.trim(), ...(query.match(/[a-z0-9]+(?:[-_.][a-z0-9]+)*|[\u3400-\u9fff]+/gi) || [])].filter(Boolean);
  const groups = doc.blocks.filter(b => b.kind === "術語").map(b => [b.fields.中文?.replace(/\s*[（(]暫定譯名[)）]/g, ""), b.fields.原文, ...ids(b.fields.別名)].filter((s): s is string => !!s && !["無", "不適用", "未確認"].includes(s)));
  const reasons = terms.flatMap(term => {
    const aliases = [term, ...groups.filter(group => group.some(alias => normalize(alias) === normalize(term))).flat()];
    return aliases.flatMap(alias => [["編號", block.id], ...Object.entries(block.fields)].filter(([, value]) => normalize(value).includes(normalize(alias))).map(([field]) => ({ field, term: alias, alias: normalize(alias) !== normalize(term) ? term : "" })));
  });
  return [...new Map(reasons.map(r => [`${r.field}:${normalize(r.term)}`, r])).values()].slice(0, 4);
}
export function relatedEntries(doc: EditorialDocument, block: EditorialBlock) {
  return doc.blocks.filter(b => ["規則", "FAQ"].includes(b.kind) && b.id !== block.id && [
    ids(block.fields.相關規則).includes(b.id), ids(block.fields.引用).includes(b.id),
    ids(b.fields.相關規則).includes(block.id), ids(b.fields.引用).includes(block.id),
  ].some(Boolean));
}
export function pdfPageLink(value: string, pageText: string) {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    const page = pages(pageText)[0];
    const directPdf = /\.pdf$/i.test(url.pathname);
    if (page && directPdf) url.hash = `page=${page}`;
    return { href: url.href, page: directPdf ? page : undefined };
  } catch { return null; }
}

// FAQ page locations come from their cited rules in this same document.
export function entryPages(doc: EditorialDocument, block: EditorialBlock, sourceId: string): number[] {
  const entries = block.kind === "FAQ"
    ? doc.blocks.filter(b => b.kind === "規則" && ids(block.fields.引用).includes(b.id))
    : [block];
  return [...new Set(entries.filter(b => ids(b.fields.來源).includes(sourceId)).flatMap(b => pages(b.fields.PDF頁碼)))].sort((a, b) => a - b);
}

export function sourcePageCount(source?: EditorialBlock): number {
  const count = Number(source?.fields.PDF頁數);
  return Number.isInteger(count) && count > 0 && count <= 1000 ? count : 0;
}
