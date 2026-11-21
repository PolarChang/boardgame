import { z } from "zod";
import { ids, type EditorialDocument } from "./editorial";
import { answerEvidence } from "./knowledge-evidence";

const visualSchema = z.object({ asset_id: z.string(), block_id: z.string(), version: z.string(), source_id: z.string(), page: z.number(), caption: z.string(), alt: z.string() });
export const answerSchema = z.object({
  answer: z.string(), citations: z.array(z.string()), kind: z.string(),
  visual_citations: z.array(visualSchema).optional(), missing_context: z.array(z.string()).optional(),
  candidates: z.array(z.string()).optional(), resolution_status: z.string().optional(), cache_status: z.string().optional(),
});
export type KnowledgeAnswer = z.infer<typeof answerSchema>;
export const contextSchema = z.object({ role: z.string(), players: z.string(), expansion: z.string(), stage: z.string() });
export type QuestionContext = z.infer<typeof contextSchema>;
export const messageSchema = z.object({ question: z.string(), answer: answerSchema, context: contextSchema.optional() });
export type KnowledgeMessage = z.infer<typeof messageSchema>;
export const conversationSchema = z.object({
  question: z.string(), selected: z.string(), context: contextSchema,
  messages: z.array(messageSchema), pending: z.object({ payload: z.string(), id: z.string() }).nullable(),
  expanded: z.array(z.string()).default([]),
  reviews: z.record(z.string(), z.object({ question: z.string(), confirmed: z.boolean() })).default({}),
});
export const conversationKey = (gameId: string, version: string) => `knowledge-conversation:v1:${JSON.stringify([gameId, version])}`;
const blockSchema = z.object({ id: z.string(), kind: z.string(), fields: z.record(z.string(), z.string()) });
const recordSchema = z.object({
  schema: z.literal(1), id: z.string().regex(/^[a-f0-9]{64}$/), gameId: z.string(), gameName: z.string(), version: z.string(),
  savedAt: z.number().min(0).max(8.64e15), message: messageSchema, blocks: z.array(blockSchema),
  review: z.object({ kind: z.literal("reader-confirmed"), originalQuestion: z.string() }).optional(),
});
export type KnowledgeRecord = z.infer<typeof recordSchema>;
const prefix = "knowledge-answer:v1:";

/** Each answer has its own key so saving one record cannot overwrite another tab's collection. */
export function readKnowledgeRecords(storage: Storage): { records: KnowledgeRecord[]; invalid: number } {
  const records: KnowledgeRecord[] = [];
  let invalid = 0;
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key?.startsWith(prefix)) continue;
    try {
      const parsed = recordSchema.safeParse(JSON.parse(storage.getItem(key) || "null"));
      if (parsed.success && key === prefix + parsed.data.id) records.push(parsed.data); else invalid++;
    } catch { invalid++; }
  }
  return { records: records.sort((a, b) => b.savedAt - a.savedAt || a.id.localeCompare(b.id)), invalid };
}

export async function saveKnowledgeAnswer(storage: Storage, gameId: string, version: string, document: EditorialDocument, message: KnowledgeMessage, review?: { question: string; confirmed: boolean }) {
  if (!review?.confirmed || !review.question.trim() || !version.trim() || !answerEvidence(document, message.answer).canReview) throw new Error("請先補齊問題與原文依據，並核對原文支持回答後再保存。");
  const originalQuestion = message.question;
  message = { ...message, question: review.question.trim() };
  const confirmation = { kind: "reader-confirmed" as const, originalQuestion };
  // Snapshot the cited entries and their source chain, never fetch the current document when opening a saved answer.
  const included = new Set(message.answer.citations);
  for (const visual of message.answer.visual_citations || []) { included.add(visual.block_id); included.add(visual.source_id); }
  let size = -1;
  while (size !== included.size) {
    size = included.size;
    for (const block of document.blocks.filter(item => included.has(item.id))) {
      for (const id of [...ids(block.fields.引用 || ""), ...ids(block.fields.來源 || "")]) included.add(id);
    }
  }
  const blocks = document.blocks.filter(block => included.has(block.id));
  const gameName = document.blocks.find(block => block.kind === "文件")?.fields.遊戲 || gameId;
  // Full content identity: identical saves deduplicate; different answers/contexts/versions remain separate.
  const identity = JSON.stringify({ gameId, version, message, blocks, review: confirmation });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  const id = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
  const key = prefix + id;
  const existing = storage.getItem(key);
  if (existing) {
    const record = recordSchema.parse(JSON.parse(existing));
    if (record.id !== id) throw new Error("紀錄資料無效");
    return record;
  }
  const record = recordSchema.parse({ schema: 1, id, gameId, gameName, version, savedAt: Date.now(), message, blocks, review: confirmation });
  storage.setItem(key, JSON.stringify(record));
  return record;
}
