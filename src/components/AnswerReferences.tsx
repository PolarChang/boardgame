import { answerEvidence } from "@/lib/knowledge-evidence";
import { pdfPageLink } from "@/lib/editorial-reader";
import type { EditorialDocument } from "@/lib/editorial";
import type { KnowledgeAnswer } from "@/lib/knowledge-records";

export default function AnswerReferences({ document, answer, sourceHref }: { document: EditorialDocument; answer: KnowledgeAnswer; sourceHref?: (page: number, blockId: string) => string }) {
  const evidence = answerEvidence(document, answer);
  return <section className="answer-references" aria-label="參考原文">
    <h3 className="font-semibold">參考原文</h3>
    {!evidence.entries.length && <p className="knowledge-muted mt-2 leading-7">目前沒有可顯示的規則原文；這個回答尚不能作為已核對的參考問答。</p>}
    <ol className="mt-3 space-y-5">{evidence.entries.map((entry, index) => <li key={entry.block.id}>
      <p className="text-sm leading-7">[{index + 1}] {entry.sources.map(source => `${source.fields.名稱 || "來源名稱未提供"}（${source.fields.版本 || "版次未提供"}）`).join("；") || "來源未提供"} · PDF 第 {entry.pages.join("、") || "未提供"} 頁{entry.block.fields.章節 && ` · ${entry.block.fields.章節}`}</p>
      <blockquote className="mt-2 whitespace-pre-wrap border-l-2 border-current pl-4 leading-8">{entry.quote}</blockquote>
      <div className="mt-2 flex flex-wrap gap-x-4">{sourceHref ? entry.pages.map(page => <a key={page} className="knowledge-link inline-flex min-h-11 items-center underline" href={sourceHref(page, entry.block.id)}>查看原頁 · PDF 第 {page} 頁</a>) : entry.sources.flatMap(source => entry.pages.map(page => {
        const link = pdfPageLink(source.fields.網址 || "", String(page));
        return link && <a key={`${source.id}:${page}`} className="knowledge-link inline-flex min-h-11 items-center underline" href={link.href} target="_blank" rel="noreferrer">查看原頁 · PDF 第 {page} 頁（新分頁）</a>;
      }))}</div>
    </li>)}</ol>
    {evidence.issues.length > 0 && <p className="knowledge-muted mt-3 text-sm leading-7">尚待補齊：{evidence.issues.join("；")}。</p>}
  </section>;
}
