import { XMLParser } from "fast-xml-parser";

interface BGGDetails {
  type: "Base" | "Expansion";
  chineseName: string;
}

/**
 * 從 BGG API 獲取遊戲資訊並解析主擴與中文名稱
 */
export async function getBGGGameDetails(bggId: number): Promise<BGGDetails | null> {
  try {
    const response = await fetch(`https://boardgamegeek.com/xmlapi2/thing?id=${bggId}`);
    if (!response.ok) throw new Error(`BGG API error: ${response.status}`);

    const xmlData = await response.text();
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
    const json = parser.parse(xmlData);

    const item = json.items?.item;
    if (!item) return null;

    // 1. 判定 Type
    const type = item.type === "boardgameexpansion" ? "Expansion" : "Base";

    // 2. 抓取中文名稱
    let chineseName = "";
    const names = Array.isArray(item.name) ? item.name : [item.name];
    
    for (const name of names) {
      if (name.value && /[\u4e00-\u9fa5]/.test(name.value)) {
        chineseName = name.value;
        break;
      }
    }

    return { type, chineseName };
  } catch (error) {
    console.error("Error fetching BGG details:", error);
    return null;
  }
}

/**
 * 示範如何整合進 Notion API 更新/建立資料
 */
export async function updateNotionGame(pageId: string, details: BGGDetails) {
  // 假設你已有 notionClient 實例
  // const notion = getNotionClient();
  
  const properties: any = {
    "Type": {
      select: { name: details.type }
    },
    "Chinese Name": {
      rich_text: [{ text: { content: details.chineseName || "" } }]
    }
  };

  // 執行更新
  // await notion.pages.update({ page_id: pageId, properties });
  console.log("Notion update payload:", JSON.stringify(properties, null, 2));
}
