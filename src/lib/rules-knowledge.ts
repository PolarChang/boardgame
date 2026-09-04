/**
 * Contract for the structured rule knowledge base.
 *
 * These types intentionally use `id` as the cross-service identifier. The
 * collection CMS identifier (`pageId`) and display names must not be used to
 * join data with the rules service.
 */
export type KnowledgeGameStatus = "draft" | "review" | "published";

export interface KnowledgeGameSummary {
  id: string;
  name: string;
  publisher: string | null;
  designer: string[];
  player_count: { min: number; max: number };
  play_time: { min: number; max: number };
  complexity: string | null;
  status: KnowledgeGameStatus;
}

export interface KnowledgeGameListResponse {
  games: KnowledgeGameSummary[];
}

export interface KnowledgeGameInput {
  id: string;
  name: string;
  publisher?: string | null;
  designer?: string[];
  player_count?: { min: number; max: number };
  play_time?: { min: number; max: number };
  complexity?: string | null;
  status?: KnowledgeGameStatus;
}

export interface KnowledgeRulebookImportResult {
  document_id: string;
  rules_extracted: number;
  explicit: number;
  derived: number;
  ambiguous: number;
  conflict: number;
  need_review: number;
}

/** A Notion collection game prepared for the one-time knowledge-base mapping. */
export interface KnowledgeNotionGame {
  pageId: string;
  bggId: number;
  knowledgeGameId: string;
  name: string;
  chineseName?: string;
  publisher?: string;
  designer: string[];
  player_count: { min: number; max: number };
  play_time: { min: number; max: number };
  complexity: string | null;
}

export interface KnowledgeRuleSummary {
  id: string;
  category: string;
  type: string;
  title: string;
  rule_text: string;
  simplified_text: string | null;
  confidence: string;
  verification_status: "unverified" | "verified" | "missing_source" | "rejected" | "ambiguous";
  source: { page: number; section: string | null };
}

export interface KnowledgeRuleListResponse {
  rules: KnowledgeRuleSummary[];
}
