import { flowKinds, validateFlows } from "./editorial-flow";
export const editorialCategories = ["開始遊戲", "進行遊戲", "卡牌與配件", "計分與結束", "例外與 FAQ", "其他規則"] as const;
export type EditorialBlock = { kind: string; id: string; fields: Record<string, string> };
export type EditorialCategory = { id: string; name: string; method: string; rule_ids: string[]; assignments?: { rule_id: string; titles: string[]; method: string }[] };
export type EditorialDocument = { blocks: EditorialBlock[]; categories?: EditorialCategory[]; chapters?: { id: string; title: string; parent_id: string | null; page: string; rule_ids: string[] }[] };
export type EditorialIssue = { id: string; message: string };
const fields: Record<string, string[]> = {
  文件: ["遊戲", "版本", "NotebookLM"],
  來源: ["名稱", "版本", "PDF頁數", "網址"],
  術語: ["中文", "原文", "別名"],
  規則: ["大項", "標題", "角色", "人數", "擴充", "內容", "條件", "步驟", "成本", "結果", "限制", "例外", "相關規則", "來源", "PDF頁碼", "原文", "狀態"],
  FAQ: ["問題", "答案", "引用", "角色", "人數", "擴充", "狀態"],
  涵蓋: ["章節", "來源", "PDF頁碼", "規則", "狀態", "說明"],
  圖片: ["名稱", "別名", "替代文字", "類型", "來源", "PDF頁碼", "資產", "裁切範圍", "相關規則", "順序", "公開", "狀態"],
  流程: ["名稱", "範圍", "起點", "說明", "狀態"],
  流程節點: ["流程", "標題", "順序", "規則", "角色", "人數", "擴充", "結束", "說明", "狀態"],
  流程連線: ["流程", "起點", "終點", "條件", "順序", "循環", "狀態"],
};
export const editorialFields = fields;
export function serializeEditorial(doc: EditorialDocument): string {
  const version = doc.blocks.some(b => b.kind === "圖片" || flowKinds.includes(b.kind)) ? 2 : 1;
  return `# 規則整理稿 v${version}\n\n` + doc.blocks.map(b => `## ${b.kind} ${b.id}\n` + Object.entries(b.fields).map(([key, value]) => `${key}：${value}`).join("\n")).join("\n\n");
}
export const ids = (value = "") => value.split(/[,，、\n]/).map(x => x.trim()).filter(Boolean);
export function pages(value = ""): number[] {
  const result = new Set<number>();
  for (const part of value.split(/[,，、]/)) {
    const segment = part.trim();
    if (!/^\d+(?:\s*[-–]\s*\d+)?$/.test(segment)) return [];
    const [start, end = start] = segment.split(/[-–]/).map(Number);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start || end > 1000) return [];
    for (let page = start; page <= end; page++) result.add(page);
  }
  return [...result].sort((a, b) => a - b);
}
export function parseEditorial(text: string): { document: EditorialDocument; issues: EditorialIssue[]; draftIssues?: EditorialIssue[] } {
  const blocks: EditorialBlock[] = [], issues: EditorialIssue[] = [];
  let current: EditorialBlock | undefined, field = "";
  for (const [index, raw] of text.replace(/^\uFEFF/, "").split(/\r?\n/).entries()) {
    const line = raw.trimEnd();
    const heading = /^#{1,6}\s+(文件|來源|術語|規則|FAQ|涵蓋|圖片|流程|流程節點|流程連線)\s+([A-Za-z0-9_-]+)$/.exec(line);
    if (heading) { current = { kind: heading[1], id: heading[2], fields: {} }; blocks.push(current); field = ""; continue; }
    if (!line.trim() || /^#{1,6}\s+規則整理稿 v[12]$/.test(line)) { if (current && field && line === "") current.fields[field] += "\n"; continue; }
    const label = /^([^：:]+)[：:](.*)$/.exec(line);
    if (current && label && fields[current.kind].includes(label[1])) {
      field = label[1];
      if (field in current.fields) issues.push({ id: current.id, message: `欄位「${field}」重複` });
      current.fields[field] = label[2].trim();
    } else if (current && field && !/^#{1,6}\s/.test(line)) current.fields[field] += `\n${line}`;
    else issues.push({ id: `第 ${index + 1} 行`, message: "無法辨識的段落；請依範本保留標題與欄位名稱" });
  }
  blocks.forEach(b => Object.keys(b.fields).forEach(k => { b.fields[k] = b.fields[k].trim(); }));
  const document = { blocks };
  return { document, issues: [...issues, ...validateEditorial(document)], draftIssues: [...issues, ...validateDraft(document)] };
}
export function validateDraft(doc: EditorialDocument): EditorialIssue[] {
  const issues: EditorialIssue[] = [], seen = new Set<string>();
  if (!Array.isArray(doc.blocks) || !doc.blocks.length) return [{ id: "文件", message: "缺少段落" }];
  for (const block of doc.blocks) {
    if (!fields[block.kind] || !/^[A-Za-z0-9_-]+$/.test(block.id) || !block.fields || Object.values(block.fields).some(v => typeof v !== "string")) issues.push({ id: block.id, message: "段落結構無效" });
    if (seen.has(block.id)) issues.push({ id: block.id, message: "編號重複" });
    seen.add(block.id);
  }
  return issues;
}
export function validateEditorial(doc: EditorialDocument): EditorialIssue[] {
  const issues: EditorialIssue[] = [], seen = new Set<string>();
  const add = (b: EditorialBlock, message: string) => issues.push({ id: b.id, message });
  const byKind = (kind: string) => doc.blocks.filter(b => b.kind === kind);
  if (byKind("文件").length !== 1) issues.push({ id: "文件", message: "必須有且只有一個文件段落" });
  for (const kind of ["來源", "術語", "規則", "涵蓋"]) if (!byKind(kind).length) issues.push({ id: kind, message: `缺少${kind}段落` });
  const required: Record<string, string[]> = { 文件: ["遊戲", "版本"], 來源: ["名稱", "版本", "PDF頁數"], 術語: ["中文", "原文"], 規則: ["大項", "標題", "角色", "人數", "擴充", "內容", "條件", "例外", "來源", "PDF頁碼", "原文", "狀態"], FAQ: ["問題", "答案", "引用", "角色", "人數", "擴充", "狀態"], 涵蓋: ["章節", "來源", "PDF頁碼", "狀態"] };
  for (const b of doc.blocks) {
    if (Object.values(b.fields).some(value => /未確認|請填|請貼/.test(value))) add(b, "仍有未確認內容或範本佔位文字");
    if (seen.has(b.id)) add(b, "編號重複"); seen.add(b.id);
    for (const key of required[b.kind] || []) if (!b.fields[key]) add(b, `缺少「${key}」`);
    if (b.kind === "規則" && !editorialCategories.some(c => c === b.fields.大項)) add(b, "大項不在固定分類中");
    if (b.kind === "規則" && b.fields.標題 && !/[\u3400-\u9fff]/.test(b.fields.標題)) add(b, "細項標題須包含中文，請先完成中文校對");
    if (["規則", "FAQ"].includes(b.kind) && b.fields.狀態 !== "已確認") add(b, "尚未人工確認，不可發布");
    if (b.kind === "來源" && (!/^\d+$/.test(b.fields.PDF頁數) || Number(b.fields.PDF頁數) < 1)) add(b, "PDF頁數須為正整數");
    if (b.fields.網址 && !/^https:\/\//.test(b.fields.網址)) add(b, "來源網址必須以 https:// 開頭");
    if (b.fields.NotebookLM && !/^https:\/\/notebooklm\.google\.com\//.test(b.fields.NotebookLM)) add(b, "NotebookLM 連結格式不符");
    if (["規則", "涵蓋"].includes(b.kind)) {
      const source = byKind("來源").find(s => s.id === b.fields.來源), span = pages(b.fields.PDF頁碼);
      if (!source) add(b, "來源編號不存在");
      if (!span.length || (source && span.some(p => p > Number(source.fields.PDF頁數)))) add(b, "PDF頁碼無效或超出來源頁數");
    }
    const refs = b.kind === "FAQ" ? b.fields.引用 : b.kind === "涵蓋" ? b.fields.規則 : b.fields.相關規則;
    for (const id of ids(refs)) if (!byKind("規則").some(r => r.id === id)) add(b, `引用的規則 ${id} 不存在`);
    if (b.kind === "涵蓋") {
      if (!["已整理", "不適用"].includes(b.fields.狀態)) add(b, "章節尚未整理完畢");
      if (b.fields.狀態 === "已整理" && !ids(b.fields.規則).length) add(b, "已整理章節須列出規則編號");
      if (b.fields.狀態 === "不適用" && !b.fields.說明) add(b, "不適用章節須說明原因");
      for (const id of ids(b.fields.規則)) {
        const rule = byKind("規則").find(r => r.id === id);
        if (rule && (rule.fields.來源 !== b.fields.來源 || !pages(rule.fields.PDF頁碼).some(p => pages(b.fields.PDF頁碼).includes(p)))) add(b, `規則 ${id} 不屬於此來源或頁面範圍`);
      }
    }
    if (b.kind === "圖片") {
      for (const key of ["名稱", "替代文字", "來源", "PDF頁碼", "資產", "相關規則", "狀態"]) if (!b.fields[key]) add(b, `缺少「${key}」`);
      if (!/^[a-f0-9]{64}$/.test(b.fields.資產 || "")) add(b, "圖片資產無效");
      if (b.fields.狀態 !== "已確認") add(b, "圖片尚未人工確認，不可發布");
      const source = byKind("來源").find(s => s.id === b.fields.來源);
      if (!source || pages(b.fields.PDF頁碼).length !== 1 || pages(b.fields.PDF頁碼)[0] > Number(source.fields.PDF頁數)) add(b, "圖片來源或頁碼無效");
      if (!["是", "否"].includes(b.fields.公開)) add(b, "請指定圖片是否可公開");
      if (!/^\d+$/.test(b.fields.順序 || "")) add(b, "圖片順序須為非負整數");
    }
  }
  for (const source of byKind("來源")) {
    const covered = new Set(byKind("涵蓋").filter(c => c.fields.來源 === source.id).flatMap(c => pages(c.fields.PDF頁碼)));
    const count = Number(source.fields.PDF頁數);
    if (count > 1000) add(source, "單一來源目前最多支援 1000 頁");
    if (count <= 1000 && Array.from({ length: Math.max(0, count || 0) }, (_, i) => i + 1).some(p => !covered.has(p))) add(source, "涵蓋表尚未交代所有 PDF 頁面（封面等請標示不適用）");
  }
  return [...issues, ...validateFlows(doc)];
}
export function editorialDiff(before: EditorialDocument | null, after: EditorialDocument) {
  const old = new Map((before?.blocks || []).map(b => [b.id, b]));
  const next = new Map(after.blocks.map(b => [b.id, b]));
  return [...new Set([...old.keys(), ...next.keys()])].flatMap(id => {
    const a = old.get(id), b = next.get(id);
    const canonical = (block?: EditorialBlock) => block ? JSON.stringify([block.kind, block.id, Object.entries(block.fields).sort(([a], [b]) => a.localeCompare(b))]) : "";
    return canonical(a) === canonical(b) ? [] : [{ id, change: !a ? "新增" : !b ? "刪除" : "修改", before: a, after: b }];
  });
}
export function searchEditorial(doc: EditorialDocument, query: string, category = "", role = "", players = "", expansion = "") {
  const normalized = query.normalize("NFKC").toLowerCase().trim();
  const normalize = (value: string) => value.normalize("NFKC").toLowerCase().trim();
  // Keep Chinese phrases and rule IDs intact; a shared character is not a match.
  const terms = normalized.match(/[a-z0-9]+(?:[-_.][a-z0-9]+)*|[\u3400-\u9fff]+/g) || [];
  const glossary = doc.blocks.filter(b => b.kind === "術語").map(b =>
    [b.fields.中文?.replace(/\s*[（(]暫定譯名[)）]/g, ""), b.fields.原文, ...ids(b.fields.別名)]
      .filter((t): t is string => !!t && !["無", "不適用", "未確認"].includes(t)).map(normalize));
  const alternatives = (term: string) => [term, ...glossary.filter(group => group.includes(term)).flat()];
  const phraseAlternatives = alternatives(normalized);
  return doc.blocks.filter(b => ["規則", "FAQ"].includes(b.kind) && (!category || b.fields.大項 === category || category === "例外與 FAQ" && b.kind === "FAQ") && [[role, "角色"], [players, "人數"], [expansion, "擴充"]].every(([value, key]) => !value || b.fields[key] === "全部" || ids(b.fields[key]).includes(value))).map(b => {
    const hay = normalize([b.id, ...Object.values(b.fields)].join(" "));
    const phraseMatch = phraseAlternatives.some(t => t && hay.includes(t));
    const allTermsMatch = terms.length > 0 && terms.every(t => alternatives(t).some(alias => hay.includes(alias)));
    const titleMatch = phraseAlternatives.some(t => t && normalize(b.fields.標題 || b.fields.問題 || "").includes(t));
    const score = !normalized ? 1 : normalize(b.id) === normalized ? 100 : titleMatch ? 40 : phraseMatch ? 20 : allTermsMatch ? 10 : 0;
    return { block: b, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).map(x => x.block);
}
