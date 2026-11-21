import { webcrypto } from "node:crypto";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { readKnowledgeRecords, saveKnowledgeAnswer, type KnowledgeMessage } from "./knowledge-records";
import type { EditorialDocument } from "./editorial";

const document: EditorialDocument = { blocks: [
  { id: "D1", kind: "文件", fields: { 遊戲: "測試遊戲" } },
  { id: "F1", kind: "FAQ", fields: { 引用: "R1", 答案: "支付二枚" } },
  { id: "R1", kind: "規則", fields: { 來源: "S1", PDF頁碼: "2", 內容: "支付二枚資源", 原文: "Pay two resources." } },
  { id: "S1", kind: "來源", fields: { 名稱: "測試原書", 版本: "初版", 網址: "https://example.com/original.pdf" } },
  { id: "R2", kind: "規則", fields: { 內容: "無關內容" } },
] };
const review = { question: "《測試遊戲》三人局執行支付動作時，需要支付幾枚資源？", confirmed: true };
const message: KnowledgeMessage = { question: "支付多少？", answer: { answer: "支付二枚", citations: ["F1"], kind: "faq" }, context: { role: "", players: "3", expansion: "", stage: "" } };
beforeEach(() => { localStorage.clear(); vi.stubGlobal("crypto", webcrypto); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("deduplicates identical saves while keeping different versions and games", async () => {
  const first = await saveKnowledgeAnswer(localStorage, "game", "v1", document, message, review);
  expect((await saveKnowledgeAnswer(localStorage, "game", "v1", document, message, review)).id).toBe(first.id);
  await saveKnowledgeAnswer(localStorage, "game", "v2", document, message, review);
  await saveKnowledgeAnswer(localStorage, "other", "v1", document, message, review);
  expect(readKnowledgeRecords(localStorage).records).toHaveLength(3);
});

it("preserves the original cited rule and source chain without copying unrelated entries", async () => {
  const saved = await saveKnowledgeAnswer(localStorage, "game", "v1", document, message, review);
  expect(saved.blocks.map(block => block.id)).toEqual(["F1", "R1", "S1"]);
  const current = structuredClone(document);
  current.blocks[2].fields.內容 = "支付五枚資源";
  const restored = readKnowledgeRecords(localStorage).records[0];
  expect(restored.blocks.find(block => block.id === "R1")?.fields.內容).toBe("支付二枚資源");
  expect(restored.version).toBe("v1");
});

it("keeps corrupt records intact and reports them alongside valid records", async () => {
  const valid = await saveKnowledgeAnswer(localStorage, "game", "v1", document, message, review);
  localStorage.setItem("knowledge-answer:v1:broken", "{bad json");
  localStorage.setItem("unrelated", "untouched");
  expect(readKnowledgeRecords(localStorage)).toMatchObject({ invalid: 1, records: [{ id: valid.id }] });
  expect(localStorage.getItem("knowledge-answer:v1:broken")).toBe("{bad json");
  expect(localStorage.getItem("unrelated")).toBe("untouched");
});

it("reports a failed save instead of treating a quota error as success", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
  await expect(saveKnowledgeAnswer(localStorage, "game", "v1", document, message, review)).rejects.toThrow();
});

it("rejects missing reader confirmation and incomplete evidence without writing a record", async () => {
  await expect(saveKnowledgeAnswer(localStorage, "game", "v1", document, message)).rejects.toThrow("核對");
  const missing = structuredClone(document); delete missing.blocks[2].fields.原文;
  await expect(saveKnowledgeAnswer(localStorage, "game", "v1", missing, message, review)).rejects.toThrow("原文");
  expect(readKnowledgeRecords(localStorage).records).toHaveLength(0);
});

it("stores the clarified question and preserves legacy records without silently upgrading them", async () => {
  const saved = await saveKnowledgeAnswer(localStorage, "game", "v1", document, message, review);
  expect(saved.message.question).toBe(review.question);
  expect(saved.review?.originalQuestion).toBe(message.question);
  const legacy = { ...saved }; delete legacy.review;
  const raw = JSON.stringify(legacy), key = `knowledge-answer:v1:${saved.id}`;
  localStorage.setItem(key, raw);
  expect(readKnowledgeRecords(localStorage).records[0].review).toBeUndefined();
  expect(localStorage.getItem(key)).toBe(raw);
});
