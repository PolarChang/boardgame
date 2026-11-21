// Hand-calculated oracle: 4 players, <=60 minutes => Harbor and Meadow only.
export const games = [
  ["harbor", "驗證港灣", 2, 4, 60, 8],
  ["meadow", "驗證草原", 4, 4, 45, 0],
  ["duel", "驗證對決", 2, 2, 30, 7],
  ["marathon", "驗證長局", 2, 5, 120, 9],
].map(([id, name, minPlayers, maxPlayers, playTime, rating], index) => ({
  pageId: id, bggId: index + 1, name, image: "", minPlayers, maxPlayers,
  playTime, rating, complexity: 2, bestPlayers: "4", playCount: 0,
  type: "Base", ownership: "Owned", bggLink: "",
}));

export function release(origin) {
  return { version: "verification-v1", document: { blocks: [
    { kind: "文件", id: "DOC", fields: { 遊戲: "驗證港灣", 版本: "測試版一" } },
    { kind: "來源", id: "S1", fields: { 名稱: "港灣測試原書 · 測試版一", 網址: `${origin}/verification-source#page-2`, PDF頁數: "2" } },
    { kind: "規則", id: "R1", fields: { 標題: "港口移動", 內容: "每回合只能移動兩格。", 原文: "Move exactly two spaces each turn.", 來源: "S1", PDF頁碼: "2", 狀態: "已確認" } },
  ] } };
}

// Synthetic original, independent of the reader's rendered rule fields.
export const sourceHtml = `<!doctype html><html lang="zh-TW"><meta charset="utf-8"><title>港灣測試原書</title>
<style>body{font:20px sans-serif;max-width:700px;margin:30px auto;padding:16px}section{min-height:90vh}:target{outline:3px solid #876321}</style>
<h1>港灣測試原書 · 測試版一</h1><section id="page-1"><h2>第 1 頁：準備</h2><p>Place one ship in the harbor.</p></section>
<section id="page-2"><h2>第 2 頁：移動</h2><p>Move exactly two spaces each turn.</p></section></html>`;
