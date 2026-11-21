import type { EditorialBlock } from "@/lib/editorial";
export function changedSpan(before: string, after: string) {
  let start = 0, end = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  while (end < before.length - start && end < after.length - start && before[before.length - end - 1] === after[after.length - end - 1]) end++;
  return { prefix: before.slice(0, start), removed: before.slice(start, before.length - end), added: after.slice(start, after.length - end), suffix: end ? before.slice(-end) : "" };
}
export default function EditorialChanges({ before, after }: { before?: EditorialBlock; after?: EditorialBlock }) {
  const keys = [...new Set([...Object.keys(before?.fields || {}), ...Object.keys(after?.fields || {})])].filter(k => before?.fields[k] !== after?.fields[k]);
  return <div className="my-3 space-y-4">{!after && <p className="font-semibold">此條目將整筆刪除，請核對其引用與涵蓋。</p>}{keys.map(key => { const a = before?.fields[key] || "", b = after?.fields[key] || ""; const diff = changedSpan(a, b); return <section key={key} className="rounded-lg border border-grid-line p-3"><h4 className="font-semibold">{key}{["條件", "成本", "限制", "例外"].includes(key) ? " · 請優先核對" : ""}</h4><div className="mt-2 grid gap-3 sm:grid-cols-2"><div><p className="text-xs">修改前</p><p className="whitespace-pre-wrap break-words text-sm leading-7">{a ? <>{diff.prefix}<del className="bg-red-100 text-red-900">{diff.removed}</del>{diff.suffix}</> : "（無）"}</p></div><div><p className="text-xs">修改後</p><p className="whitespace-pre-wrap break-words text-sm leading-7">{b ? <>{diff.prefix}<ins className="bg-green-100 text-green-900">{diff.added}</ins>{diff.suffix}</> : "（已移除）"}</p></div></div></section>; })}</div>;
}
