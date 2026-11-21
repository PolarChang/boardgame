import { ids, type EditorialBlock, type EditorialDocument } from "./editorial";
export const topics = ["開始與回合流程", "工人與公司", "購買與資源", "政策與投票", "稅金與貸款", "計分與結束", "卡牌與其他"];
export const emptyField = (value: string) => /^(無|不適用|無需|沒有)$/.test(value.trim());
export function topicOf(block: EditorialBlock, doc: EditorialDocument): string {
  if (block.kind === "FAQ") {
    const rule = doc.blocks.find(b => b.kind === "規則" && ids(block.fields.引用).includes(b.id));
    if (rule) return topicOf(rule, doc);
  }
  const title = block.fields.標題 || block.fields.問題 || "";
  if (/稅|貸款|IMF|基金|收入與資本/.test(title)) return topics[4];
  if (/計分|遊戲結束|繁榮度滿/.test(title)) return topics[5];
  if (/投票|選舉|法案|政策|政治|議員|合法性/.test(title)) return topics[3];
  if (/工人|公司|罷工|示威|工會|農場|加班|薪資|機器/.test(title) && !/設置/.test(title)) return topics[1];
  if (/購買|資源|商品|服務|福利|醫療|教育|奢華|貿易|合約|儲存/.test(title)) return topics[2];
  if (/設置|準備|流程|階段|人數/.test(title) || block.fields.大項 === "開始遊戲") return topics[0];
  return topics[6];
}
