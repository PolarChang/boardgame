"use client";
import { useEffect, useState } from "react";

export default function EditorialVisualPreview({ gameId, asset, password }: { gameId: string; asset: string; password: string }) {
  const [url, setUrl] = useState(""), [error, setError] = useState("");
  useEffect(() => {
    if (!asset || !password) return;
    let active = true, objectUrl = "";
    const controller = new AbortController();
    setUrl(""); setError("");
    fetch(`/api/rules/knowledge/games/${encodeURIComponent(gameId)}/editorial/visuals/${encodeURIComponent(asset)}`, { headers: { "X-Knowledge-Admin": password }, signal: controller.signal }).then(async r => {
      if (!r.ok) throw new Error("圖片預覽無法載入");
      const blob = await r.blob(); if (!active) return;
      objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
    }).catch(() => { if (active) setError("圖片預覽無法載入，請檢查管理密碼與來源。"); });
    return () => { active = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [gameId, asset, password]);
  if (!password) return <p className="text-sm">輸入管理密碼後可核對私有圖片。</p>;
  return <div className="my-3">{error && <p role="alert">{error}</p>}{url && <a href={url} target="_blank" rel="noreferrer" aria-label="放大待校對圖片">
    {/* Authenticated local blob previews must not go through the public image optimizer. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={url} alt="待校對的原書裁切圖片，請核對名稱與替代文字" className="max-h-96 max-w-full object-contain" />
  </a>}</div>;
}
