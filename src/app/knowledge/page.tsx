"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { KnowledgeGameInput, KnowledgeGameStatus, KnowledgeGameSummary, KnowledgeNotionGame, KnowledgeRulebookImportResult } from "@/lib/rules-knowledge";

const statusLabels: Record<KnowledgeGameStatus, string> = {
  draft: "草稿",
  review: "待審核",
  published: "已發布",
};

function statusClass(status: KnowledgeGameStatus) {
  return status === "published"
    ? "bg-emerald-100 text-emerald-800"
    : status === "review"
      ? "bg-amber-100 text-amber-800"
      : "bg-stone-200 text-stone-700";
}

export default function KnowledgePage() {
  const [games, setGames] = useState<KnowledgeGameSummary[]>([]);
  const [notionGames, setNotionGames] = useState<KnowledgeNotionGame[]>([]);
  const [selectedNotionPageId, setSelectedNotionPageId] = useState("");
  const [selectedGameId, setSelectedGameId] = useState("");
  const [rulebook, setRulebook] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [language, setLanguage] = useState("en");
  const [loadingGames, setLoadingGames] = useState(true);
  const [loadingNotionGames, setLoadingNotionGames] = useState(true);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedGame = useMemo(
    () => games.find((item) => item.id === selectedGameId),
    [games, selectedGameId],
  );
  const selectedNotionGame = useMemo(
    () => notionGames.find((item) => item.pageId === selectedNotionPageId),
    [notionGames, selectedNotionPageId],
  );

  const loadGames = useCallback(async () => {
    setLoadingGames(true);
    try {
      const response = await fetch("/api/rules/knowledge/games", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "無法載入遊戲清單");
      setGames(data.games || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "無法載入遊戲清單");
    } finally {
      setLoadingGames(false);
    }
  }, []);

  const loadNotionGames = useCallback(async () => {
    setLoadingNotionGames(true);
    try {
      const response = await fetch("/api/rules/knowledge/notion-games", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "無法載入 Notion 遊戲清單");
      setNotionGames(data.games || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "無法載入 Notion 遊戲清單");
    } finally {
      setLoadingNotionGames(false);
    }
  }, []);

  useEffect(() => { void loadGames(); void loadNotionGames(); }, [loadGames, loadNotionGames]);

  async function createGame() {
    if (!selectedNotionGame) return;
    setCreating(true);
    setError("");
    setNotice("");
    const payload: KnowledgeGameInput = {
      id: selectedNotionGame.knowledgeGameId,
      name: selectedNotionGame.name,
      publisher: selectedNotionGame.publisher || null,
      designer: selectedNotionGame.designer,
      player_count: selectedNotionGame.player_count,
      play_time: selectedNotionGame.play_time,
      complexity: selectedNotionGame.complexity,
      status: "draft",
    };

    try {
      const response = await fetch("/api/rules/knowledge/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || data.error || "建立遊戲失敗");
      setSelectedGameId(data.id);
      setNotice(`已建立「${data.name}」的規則知識庫對應，現在可上傳規則書。`);
      await loadGames();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "建立遊戲失敗");
    } finally {
      setCreating(false);
    }
  }

  async function uploadRulebook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedGameId || !rulebook) return;
    setUploading(true);
    setError("");
    setNotice("");
    const formData = new FormData();
    const uploadedFilename = rulebook.name;
    formData.set("file", rulebook);
    if (version.trim()) formData.set("version", version.trim());
    formData.set("language", language);

    try {
      setNotice("準備安全直傳至雲端儲存空間…");
      const uploadRequest = await fetch(`/api/rules/knowledge/games/${encodeURIComponent(selectedGameId)}/rulebooks/upload-url`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: uploadedFilename }),
      });
      const uploadData = await uploadRequest.json() as { upload_url?: string; object_name?: string; detail?: string; error?: string };
      let response: Response;
      if (uploadRequest.ok && uploadData.upload_url && uploadData.object_name) {
        setNotice("正在將 PDF 直接上傳至 Cloud Storage…");
        const put = await fetch(uploadData.upload_url, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: rulebook });
        if (!put.ok) throw new Error("PDF 上傳至 Cloud Storage 失敗");
        setNotice("PDF 已上傳，正在擷取與整理規則…");
        response = await fetch(`/api/rules/knowledge/games/${encodeURIComponent(selectedGameId)}/rulebooks/import`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ object_name: uploadData.object_name, filename: uploadedFilename, version: version.trim() || undefined, language }),
        });
      } else if (uploadRequest.status === 503) {
        response = await fetch(`/api/rules/knowledge/games/${encodeURIComponent(selectedGameId)}/rulebooks`, { method: "POST", body: formData });
      } else {
        throw new Error(uploadData.detail || uploadData.error || "無法建立安全上傳連結");
      }
      const data = await response.json() as KnowledgeRulebookImportResult & { detail?: string; error?: string };
      if (!response.ok) throw new Error(data.detail || data.error || "上傳規則書失敗");
      setRulebook(null);
      setVersion("");
      setNotice(`已匯入 ${uploadedFilename}：建立 ${data.rules_extracted} 條規則，其中 ${data.need_review} 條待審核。`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "上傳規則書失敗");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 sm:px-8">
      <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-brass">Rules archive</p>
          <h1 className="mt-2 font-heading text-3xl font-bold tracking-wide text-ink">規則知識庫管理</h1>
          <p className="mt-2 text-sm text-ink-light">建立遊戲資料，再將 PDF 規則書轉成可查詢、可審核的結構化規則。</p>
        </div>
        <span className="text-sm text-ink-light">{loadingGames ? "讀取中…" : `${games.length} 個遊戲`}</span>
      </div>

      {(error || notice) && <div className={`mb-6 rounded-sm border p-4 text-sm ${error ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>{error || notice}</div>}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]">
        <section className="card-euro rounded-sm p-6">
          <h2 className="font-heading text-lg font-semibold text-ink">已建立的遊戲</h2>
          <p className="mt-1 text-sm text-ink-light">選擇一個遊戲即可上傳其規則書。</p>
          <div className="mt-5 overflow-x-auto">
            <table className="ledger-table min-w-[620px]">
              <thead><tr><th>遊戲</th><th>玩家</th><th>時間</th><th>狀態</th><th aria-label="選擇" /></tr></thead>
              <tbody>
                {!loadingGames && games.length === 0 && <tr><td colSpan={5} className="text-center text-ink-light">尚未建立遊戲</td></tr>}
                {games.map((item) => <tr key={item.id} className={selectedGameId === item.id ? "bg-brass/10" : ""}>
                  <td><div className="font-semibold">{item.name}</div><div className="mt-0.5 text-xs text-ink-light">{item.id}</div></td>
                  <td>{item.player_count.min}–{item.player_count.max}</td><td>{item.play_time.min}–{item.play_time.max} 分</td>
                  <td><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(item.status)}`}>{statusLabels[item.status]}</span></td>
                  <td className="whitespace-nowrap"><button type="button" onClick={() => setSelectedGameId(item.id)} className="btn-euro mr-2 rounded-sm px-3 py-1.5 text-xs">{selectedGameId === item.id ? "已選取" : "選擇"}</button><Link href={`/knowledge/${encodeURIComponent(item.id)}`} className="text-xs font-semibold text-brass hover:underline">編排</Link></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-8">
          <section className="brass-border-thin rounded-sm bg-parchment-light p-6">
            <h2 className="font-heading text-lg font-semibold text-ink">從 Notion 加入遊戲</h2>
            <p className="mt-1 text-sm text-ink-light">選擇既有收藏；名稱、玩家數、時間與可用的設計師／出版商資料會自動帶入。</p>
            <label className="mt-5 block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-light">Notion 收藏遊戲</span>
              <select disabled={loadingNotionGames || creating} value={selectedNotionPageId} onChange={(event) => setSelectedNotionPageId(event.target.value)} className="input-euro w-full rounded-sm">
                <option value="">{loadingNotionGames ? "載入 Notion 遊戲中…" : "選擇遊戲"}</option>
                {notionGames.map((item) => <option key={item.pageId} value={item.pageId}>{item.chineseName ? `${item.name}（${item.chineseName}）` : item.name}</option>)}
              </select>
            </label>
            {selectedNotionGame && <div className="mt-4 rounded-sm border border-brass/40 bg-brass/5 p-4 text-sm text-ink">
              <div className="font-semibold">{selectedNotionGame.name}</div>
              <div className="mt-1 text-ink-light">規則庫 ID：{selectedNotionGame.knowledgeGameId} · {selectedNotionGame.player_count.min}–{selectedNotionGame.player_count.max} 人 · {selectedNotionGame.play_time.min}–{selectedNotionGame.play_time.max} 分</div>
              {selectedNotionGame.designer.length > 0 && <div className="mt-1 text-ink-light">設計師：{selectedNotionGame.designer.join("、")}</div>}
            </div>}
            <button type="button" onClick={() => void createGame()} disabled={!selectedNotionGame || creating} className="btn-euro-primary mt-5 w-full rounded-sm px-5 py-2 disabled:opacity-50">{creating ? "建立對應中…" : "新增至規則知識庫"}</button>
          </section>

          <section className="card-euro rounded-sm p-6">
            <h2 className="font-heading text-lg font-semibold text-ink">上傳規則書 PDF</h2>
            <p className="mt-1 text-sm text-ink-light">{selectedGame ? `將文件歸入「${selectedGame.name}」` : "請先從清單選擇一個遊戲。"}</p>
            <form className="mt-5 space-y-4" onSubmit={uploadRulebook}>
              <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-light">PDF 檔案</span><input required disabled={!selectedGameId || uploading} accept="application/pdf,.pdf" type="file" onChange={(event) => setRulebook(event.target.files?.[0] || null)} className="block w-full text-sm text-ink-light file:mr-4 file:border-0 file:bg-brass/15 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:bg-brass/25" /></label>
              <div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-light">版本（選填）</span><input disabled={!selectedGameId || uploading} value={version} onChange={(event) => setVersion(event.target.value)} className="input-euro w-full rounded-sm" placeholder="例如：第二版" /></label><label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-light">語言</span><select disabled={!selectedGameId || uploading} value={language} onChange={(event) => setLanguage(event.target.value)} className="input-euro w-full rounded-sm"><option value="en">English</option><option value="zh-TW">繁體中文</option><option value="ja">日本語</option></select></label></div>
              <button disabled={!selectedGameId || !rulebook || uploading} className="btn-euro-primary w-full rounded-sm px-5 py-2 disabled:opacity-50">{uploading ? "處理規則書中…" : "上傳並匯入"}</button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
