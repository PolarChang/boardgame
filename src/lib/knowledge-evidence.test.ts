import { expect, it } from "vitest";
import { answerEvidence } from "./knowledge-evidence";
import type { EditorialDocument } from "./editorial";

const document: EditorialDocument = { blocks: [
  { id: "F1", kind: "FAQ", fields: { 引用: "R1" } },
  { id: "R1", kind: "規則", fields: { 原文: "At the start of the Production Phase, discard the Strike token from all Companies with Level 3 Wages.", 內容: "棄掉罷工標記", PDF頁碼: "16", 來源: "S1" } },
  { id: "S1", kind: "來源", fields: { 名稱: "Hegemony Rulebook", 版本: "v1.2", PDF頁數: "40", 網址: "https://example.com/rules.pdf" } },
] };
const answer = { answer: "棄掉罷工標記", citations: ["F1"], kind: "faq" };
it("traces an FAQ to the exact original rule, source edition and PDF page", () => {
  const evidence = answerEvidence(document, answer);
  expect(evidence.canReview).toBe(true);
  expect(evidence.entries[0]).toMatchObject({ block: { id: "R1" }, pages: [16], sources: [{ id: "S1" }] });
  expect(evidence.entries[0].quote).toBe(document.blocks[1].fields.原文);
});
it("does not present a paraphrase as original text when the quote is missing", () => {
  const changed = structuredClone(document); delete changed.blocks[1].fields.原文;
  expect(answerEvidence(changed, answer)).toMatchObject({ canReview: false, entries: [] });
});
it.each(["版本", "名稱", "網址"])("blocks review when source %s is absent", field => {
  const changed = structuredClone(document); delete changed.blocks[2].fields[field];
  expect(answerEvidence(changed, answer).canReview).toBe(false);
});
it("rejects missing citations, an out-of-range page and unresolved context", () => {
  expect(answerEvidence(document, { ...answer, citations: ["missing"] }).canReview).toBe(false);
  const changed = structuredClone(document); changed.blocks[1].fields.PDF頁碼 = "41";
  expect(answerEvidence(changed, answer).canReview).toBe(false);
  expect(answerEvidence(document, { ...answer, kind: "clarification", missing_context: ["stage"] }).canReview).toBe(false);
});
it("terminates cyclic FAQ references without inventing evidence", () => {
  const changed = structuredClone(document); changed.blocks[0].fields.引用 = "F1";
  expect(answerEvidence(changed, answer)).toMatchObject({ canReview: false, entries: [] });
});
