export const draftKey = (gameId: string) => `knowledge-editorial-draft:v1:${gameId}`;

/** Replace only the selected source block; preserve all other manuscript text. */
export function replaceEditorialBlock(text: string, id: string, fields: Record<string, string>) {
  const headings = [...text.matchAll(/^#{1,6}\s+(文件|來源|術語|規則|FAQ|涵蓋|圖片|流程|流程節點|流程連線)\s+([A-Za-z0-9_-]+)\s*$/gm)];
  const index = headings.findIndex(h => h[2] === id);
  if (index < 0) return text;
  const heading = headings[index];
  const end = headings[index + 1]?.index ?? text.length;
  return text.slice(0, heading.index) + `#### ${heading[1]} ${id}\n` + Object.entries(fields).map(([key, value]) => `${key}：${value}`).join("\n") + "\n\n" + text.slice(end);
}
