"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { BookOpen, Search, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import "../knowledge.css";
import type { KnowledgeRuleSummary } from "@/lib/rules-knowledge";

const sections = [
  { id: "start", title: "開始遊戲", description: "目標、配件與設置方式", categories: ["basic_info", "theme", "objective", "components", "setup"] },
  { id: "play", title: "進行遊戲", description: "流程、回合、行動與核心機制", categories: ["game_flow", "turn_structure", "actions", "resources", "mechanics", "combat"] },
  { id: "pieces", title: "卡牌與配件", description: "卡牌、板塊與標記的用法", categories: ["cards", "tiles", "tokens"] },
  { id: "score", title: "計分與結束", description: "得分、勝利與遊戲結束條件", categories: ["scoring", "end_game"] },
  { id: "faq", title: "例外與 FAQ", description: "特殊狀況、例外與常見問題", categories: ["exceptions", "faq"] },
  { id: "other", title: "其他規則", description: "尚待進一步歸類的原始條文", categories: ["unclassified"] },
] as const;

const aliases: Record<string, string[]> = {
  setup: ["設置", "準備", "開局", "setup"], objective: ["目標", "勝利", "objective", "win"],
  turn_structure: ["回合", "輪到", "turn", "round"], actions: ["行動", "可以做", "action"],
  resources: ["資源", "金錢", "收入", "resource", "money", "income"], mechanics: ["機制", "mechanic"],
  combat: ["戰鬥", "衝突", "combat"], cards: ["卡牌", "牌", "card"], tiles: ["板塊", "tile"],
  tokens: ["標記", "token"], scoring: ["計分", "得分", "分數", "score", "point"],
  end_game: ["結束", "終局", "遊戲結束", "end game"], exceptions: ["例外", "特殊", "exception"], faq: ["問題", "faq"],
};

const statusLabels: Record<KnowledgeRuleSummary["verification_status"], string> = {
  unverified: "待審核", verified: "已確認", missing_source: "缺少來源", rejected: "已排除", ambiguous: "有歧義",
};

function relevance(rule: KnowledgeRuleSummary, query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  const text = `${rule.title} ${rule.simplified_text || ""} ${rule.rule_text} ${rule.source.section || ""}`.toLocaleLowerCase();
  let score = text.includes(normalized) ? 20 : 0;
  for (const term of normalized.match(/[a-z0-9]+|[\u3400-\u9fff]{2,}/g) || []) if (text.includes(term)) score += 3;
  if ((aliases[rule.category] || []).some((alias) => normalized.includes(alias))) score += 12;
  return score;
}

export default function KnowledgeTemplatePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const [rules, setRules] = useState<KnowledgeRuleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [activeSection, setActiveSection] = useState("start");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/rules/knowledge/games/${encodeURIComponent(gameId)}/rules?limit=1000`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "無法載入規則");
        setRules(data.rules || []);
      } catch (cause) { setError(cause instanceof Error ? cause.message : "無法載入規則"); }
      finally { setLoading(false); }
    }
    void load();
  }, [gameId]);

  const counts = useMemo(() => new Map(sections.map((section) => [section.id, rules.filter((rule) => section.categories.some((category) => category === rule.category)).length])), [rules]);
  const visibleRules = useMemo(() => {
    if (submittedQuery) return rules.map((rule) => ({ rule, score: relevance(rule, submittedQuery) })).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score).slice(0, 50).map(({ rule }) => rule);
    const section = sections.find((item) => item.id === activeSection) || sections[0];
    return rules.filter((rule) => section.categories.some((category) => category === rule.category));
  }, [activeSection, rules, submittedQuery]);

  function ask(value: string) { const next = value.trim(); setQuery(next); setSubmittedQuery(next); }

  return <main className="knowledge-page mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
    <Link href="/knowledge" className="text-sm font-semibold text-brass hover:underline">← 返回規則庫</Link>
    <header className="mt-5 border-b border-grid-line pb-7">
      <h1 className="mt-2 font-heading text-3xl font-bold tracking-wide text-ink">遊戲規則</h1>
    </header>

    <section className="knowledge-reading-paths mt-6" aria-label="選擇閱讀方式"><Link href={`/knowledge/${encodeURIComponent(gameId)}/reader`}><BookOpen size={22} aria-hidden="true" /><strong>閱讀正式規則</strong></Link></section>
    <form className="card-euro mt-6 rounded-lg p-4 sm:p-5" onSubmit={(event) => { event.preventDefault(); ask(query); }}>
      <label htmlFor="rule-question" className="flex items-center gap-2 font-semibold text-ink"><Sparkles size={18} className="text-brass" />搜尋條文</label>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" size={18} /><input id="rule-question" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：回合、計分" className="input-euro min-h-12 w-full rounded-lg pl-10 pr-10" />{query && <button type="button" aria-label="清除問題" className="absolute right-2 top-1/2 min-h-10 min-w-10 -translate-y-1/2 text-ink-light" onClick={() => { setQuery(""); setSubmittedQuery(""); }}><X size={17} className="mx-auto" /></button>}</div>
        <button className="btn-euro-primary min-h-12 rounded-lg px-6" disabled={!query.trim()}>查找條文</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="常用問題">{["遊戲要怎麼設置？", "一個回合可以做什麼？", "怎麼得分？", "遊戲何時結束？"].map((prompt) => <button key={prompt} type="button" onClick={() => ask(prompt)} className="rounded-full border border-grid-line bg-parchment-light px-3 py-1.5 text-xs font-semibold text-ink-light hover:border-brass hover:text-ink">{prompt}</button>)}</div>
    </form>

    {error && <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {loading && <div role="status" className="mt-8 py-16 text-center text-ink-light"><BookOpen className="mx-auto mb-3 motion-safe:animate-pulse" />正在整理規則…</div>}
    {!loading && !error && <div className="mt-8 grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside aria-label="規則大項" className="space-y-2 lg:sticky lg:top-6 lg:self-start">
        <h2 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wider text-ink-light">規則大項</h2>
        {sections.map((section) => <button key={section.id} type="button" aria-pressed={!submittedQuery && activeSection === section.id} onClick={() => { setActiveSection(section.id); setSubmittedQuery(""); setQuery(""); }} className={`w-full rounded-lg border p-3 text-left transition ${!submittedQuery && activeSection === section.id ? "border-brass bg-brass/10" : "border-grid-line bg-parchment-light hover:border-brass/60"}`}><span className="flex items-center justify-between gap-3"><strong className="text-sm text-ink">{section.title}</strong><span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs text-stone-700">{counts.get(section.id) || 0}</span></span></button>)}
      </aside>
      <section aria-live="polite">
        <div className="flex flex-col gap-2 border-b border-brass/40 pb-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-brass">{submittedQuery ? "搜尋結果" : "瀏覽大項"}</p><h2 className="mt-1 font-heading text-2xl font-semibold text-ink">{submittedQuery ? `「${submittedQuery}」` : sections.find((item) => item.id === activeSection)?.title}</h2></div><p className="text-sm text-ink-light">找到 {visibleRules.length} 條相關規則{visibleRules.length === 50 ? "（顯示前 50 條）" : ""}</p></div>
        {visibleRules.length === 0 ? <div className="mt-5 rounded-lg border border-dashed border-grid-line p-8 text-center text-sm text-ink-light"><p className="font-semibold text-ink">找不到直接符合的規則</p><p className="mt-2">換用規則書中的名詞，或從左側大項瀏覽。</p></div> : <div className="mt-5 space-y-3">{visibleRules.map((rule) => <article key={rule.id} className="card-euro rounded-lg p-5"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start"><div><h3 className="font-semibold text-ink">{rule.title || "未命名規則"}</h3><p className="mt-1 text-xs text-ink-light">第 {rule.source.page} 頁{rule.source.section ? ` · ${rule.source.section}` : ""}</p></div><span className="w-fit rounded-full bg-stone-200 px-2.5 py-1 text-xs font-semibold text-stone-700">{statusLabels[rule.verification_status]}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-ink">{rule.simplified_text || rule.rule_text}</p>{rule.simplified_text && <details className="mt-3 text-sm text-ink-light"><summary className="cursor-pointer font-semibold">查看原始條文</summary><p className="mt-2 whitespace-pre-wrap leading-7">{rule.rule_text}</p></details>}</article>)}</div>}
      </section>
    </div>}
  </main>;
}
