"use client";
import { useEffect, useRef, useState } from "react";

type LoginProps = { gameId?: string; onLogin: (active: boolean) => void; embedded?: boolean };

export default function EditorialLogin(props: LoginProps) {
  return <GameLogin key={props.gameId || "catalogue"} {...props} />;
}

function GameLogin({ gameId, onLogin, embedded = false }: LoginProps) {
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [password, setPassword] = useState(""), [active, setActive] = useState(false), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const endpoint = gameId ? `/api/rules/knowledge/games/${encodeURIComponent(gameId)}/editorial/session` : "/api/rules/knowledge/session";
  useEffect(() => {
    let current = true;
    onLogin(false);
    fetch(endpoint, { cache: "no-store" }).then(r => {
      if (!r.ok) throw new Error("無法確認登入狀態，請重新登入。");
      return r.json();
    }).then(data => {
      if (current) { setActive(data.authenticated === true); onLogin(data.authenticated === true); }
    }).catch(() => {
      if (current) { setActive(false); onLogin(false); setError("無法確認登入狀態，請重新登入。"); }
    });
    return () => { current = false; };
  }, [endpoint, onLogin]);
  async function login() {
    setBusy(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "X-Knowledge-Admin": password } });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      if (!mounted.current) return;
      setPassword(""); setActive(true); onLogin(true);
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "登入失敗"); } finally { if (mounted.current) setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      if (!response.ok) throw new Error("登出失敗");
      if (!mounted.current) return;
      setActive(false); onLogin(false);
    } catch { if (mounted.current) setError("登出失敗，請重試"); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <section className={embedded ? "text-sm" : "card-euro my-4 rounded-lg p-4"} aria-label="管理登入">
    {active ? <div className="flex flex-wrap items-center justify-between gap-2"><p role="status">管理員已登入</p><button className="btn-euro min-h-11 rounded-lg px-4" disabled={busy} onClick={() => void logout()}>登出管理存取</button></div> : <><label className="block">管理登入密碼<input type="password" autoComplete="current-password" className="input-euro my-2 block min-h-11 w-full rounded-lg px-3" value={password} onChange={e => setPassword(e.target.value)} /></label><button className="btn-euro min-h-11 rounded-lg px-4" disabled={busy || !password} onClick={() => void login()}>{busy ? "驗證中…" : "登入"}</button></>}
    {error && <p role="alert" className="mt-2 text-red-800">{error}</p>}
  </section>;
}
