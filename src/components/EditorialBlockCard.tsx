import { EditorialBlock } from "@/lib/editorial";
import { emptyField } from "@/lib/editorial-topics";

export default function EditorialBlockCard({ block }: { block: EditorialBlock }) {
  const order = ["內容", "答案", "條件", "步驟", "成本", "結果", "限制", "例外", "相關規則", "引用", "角色", "人數", "擴充", "大項", "來源", "PDF頁碼", "原文", "狀態"];
  const metadata = ["角色", "人數", "擴充", "大項", "狀態"];
  const entries = Object.entries(block.fields).filter(([key, value]) => value && !emptyField(value) && !["標題", "問題", "原文", ...metadata].includes(key) && value.trim() !== "未確認").sort(([a], [b]) => (order.includes(a) ? order.indexOf(a) : 100) - (order.includes(b) ? order.indexOf(b) : 100));
  const pending = Object.entries(block.fields).filter(([, value]) => value.includes("未確認")).map(([key]) => key);
  return <article id={block.id} className="card-euro scroll-mt-8 rounded-lg p-5">
    <p className="text-xs text-ink-light">{block.kind} · {block.id}</p>
    <h3 className="mt-1 font-semibold text-ink">{block.fields.標題 || block.fields.問題 || block.fields.章節 || block.fields.名稱 || block.fields.中文 || block.fields.遊戲}</h3>
    <div className="mt-3 flex flex-wrap gap-2">{metadata.filter(key => block.fields[key] && !emptyField(block.fields[key])).map(key => <span key={key} className="rounded-full border border-grid-line px-3 py-1 text-xs">{key}：{block.fields[key]}</span>)}</div>
    {pending.length > 0 && <p className="mt-2 text-xs text-amber-800">待校對：{pending.join("、")}（尚未核實，不代表沒有條件或例外）</p>}
    <dl className="mt-5 space-y-5">{entries.map(([key, value]) => <div key={key} className={["限制", "例外", "成本", "條件"].includes(key) ? "rounded-lg border-l-4 border-brass bg-brass/5 p-3" : ""}><dt className="text-sm font-semibold text-ink-light">{key === "PDF頁碼" ? "PDF 頁碼" : key}</dt><dd className="mt-2 max-w-prose whitespace-pre-wrap break-words text-base leading-8 text-ink">{key === "網址" && /^https:\/\//.test(value) ? <a className="text-brass underline" href={value} target="_blank" rel="noreferrer">開啟原始來源</a> : value}</dd></div>)}</dl>
    {block.fields.原文 && <details className="mt-4 text-sm"><summary className="cursor-pointer text-brass">展開原文核對 · {block.fields.來源 || block.id} {block.fields.PDF頁碼 ? `第 ${block.fields.PDF頁碼} 頁` : ""}</summary><p className="mt-3 whitespace-pre-wrap leading-7">{block.fields.原文}</p></details>}
  </article>;
}
