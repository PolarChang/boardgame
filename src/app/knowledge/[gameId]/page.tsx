"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { KnowledgeRuleSummary } from "@/lib/rules-knowledge";

const template = [
  ["basic_info", "基本資料"], ["theme", "主題與背景"], ["objective", "遊戲目標"],
  ["components", "遊戲元件"], ["setup", "遊戲設置"], ["game_flow", "遊戲流程"],
  ["turn_structure", "回合結構"], ["actions", "行動"], ["resources", "資源"],
  ["mechanics", "核心機制"], ["cards", "卡牌"], ["tiles", "板塊"], ["tokens", "標記"],
  ["combat", "戰鬥與互動"], ["scoring", "計分"], ["end_game", "遊戲結束"],
  ["exceptions", "例外規則"], ["faq", "常見問題"], ["unclassified", "待分類"],
] as const;

const verificationLabels: Record<KnowledgeRuleSummary["verification_status"], string> = {
  unverified: "待審核", verified: "已確認", missing_source: "缺少來源", rejected: "已排除", ambiguous: "有歧義",
};

export default function KnowledgeTemplatePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const [rules, setRules] = useState<KnowledgeRuleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/rules/knowledge/games/${encodeURIComponent(gameId)}/rules?limit=1000`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "無法載入規則");
        setRules(data.rules || []);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "無法載入規則");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [gameId]);

  const sections = useMemo(() => new Map(template.map(([key]) => [key, rules.filter((rule) => rule.category === key)])), [rules]);

  return <main className="mx-auto max-w-6xl px-6 py-10 sm:px-8">
    <Link href="/knowledge" className="text-sm font-semibold text-brass hover:underline">← 返回知識庫管理</Link>
    <div className="mt-5 border-b border-grid-line pb-7">
      <p className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-brass">Rulebook template</p>
      <h1 className="mt-2 font-heading text-3xl font-bold tracking-wide text-ink">固定章節編排</h1>
      <p className="mt-2 text-sm text-ink-light">{loading ? "正在整理規則…" : `${rules.length} 條規則依預設規則書模板編排；每項均保留原始來源。`}</p>
    </div>
    {error && <div className="mt-6 rounded-sm border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {!loading && !error && <div className="mt-8 space-y-10">
      {template.map(([key, title], index) => {
        const sectionRules = sections.get(key) || [];
        return <section key={key} className="scroll-mt-6" id={key}>
          <div className="mb-4 flex items-baseline gap-3 border-b border-brass/40 pb-2"><span className="font-heading text-sm text-brass">{String(index + 1).padStart(2, "0")}</span><h2 className="font-heading text-xl font-semibold text-ink">{title}</h2><span className="text-xs text-ink-light">{sectionRules.length} 條</span></div>
          {sectionRules.length === 0 ? <p className="py-3 text-sm text-ink-light">尚無此章節的規則。</p> : <div className="space-y-3">{sectionRules.map((rule) => <article key={rule.id} className="card-euro rounded-sm p-5">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start"><div><h3 className="font-semibold text-ink">{rule.title || "未命名規則"}</h3><p className="mt-1 text-xs text-ink-light">{rule.type} · 第 {rule.source.page} 頁{rule.source.section ? ` · ${rule.source.section}` : ""}</p></div><span className="w-fit rounded-full bg-stone-200 px-2.5 py-1 text-xs font-semibold text-stone-700">{verificationLabels[rule.verification_status]}</span></div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">{rule.simplified_text || rule.rule_text}</p>
            {rule.simplified_text && <details className="mt-3 text-sm text-ink-light"><summary className="cursor-pointer font-semibold">查看原始條文</summary><p className="mt-2 whitespace-pre-wrap leading-relaxed">{rule.rule_text}</p></details>}
          </article>)}</div>}
        </section>;
      })}
    </div>}
  </main>;
}
