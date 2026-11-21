"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type Item = { id: string; content: string; votes: number; status: string; actor?: string };
type GoogleIdentity = { accounts: { id: { initialize: (options: { client_id: string; callback: (data: { credential: string }) => void }) => void; renderButton: (element: HTMLElement, options: { theme: string; size: string }) => void } } };
type Turnstile = { render: (element: HTMLElement, options: { sitekey: string; action: string; callback: (token: string) => void; "expired-callback": () => void }) => string; remove: (id: string) => void; reset: (id: string) => void };
const runtime = () => window as unknown as { google?: GoogleIdentity; turnstile?: Turnstile };

export default function EditorialCommunity({ gameId, publicRead = false, password = "" }: { gameId: string; publicRead?: boolean; password?: string }) {
  const clientId = process.env.NEXT_PUBLIC_COMMUNITY_GOOGLE_CLIENT_ID;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [token, setToken] = useState(""), [text, setText] = useState(""), [notice, setNotice] = useState("");
  const [items, setItems] = useState<Item[]>([]), [comments, setComments] = useState<Item[]>([]), [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false), [challenge, setChallenge] = useState(false), [challengeToken, setChallengeToken] = useState("");
  const [captchaReady, setCaptchaReady] = useState(false), [pendingVotes, setPendingVotes] = useState<{ actor: string; target: string }[]>([]);
  const [reporting, setReporting] = useState(false);
  const [myVotes, setMyVotes] = useState<Record<string, boolean>>({});
  const login = useRef<HTMLDivElement>(null), captcha = useRef<HTMLDivElement>(null), widget = useRef("");
  const publicQuery = publicRead ? "?public=1" : "";
  const base = `/api/rules/knowledge/games/${encodeURIComponent(gameId)}/editorial/community`;
  async function load() {
    const response = await fetch(password ? `${base}/review` : base + publicQuery, { headers: password ? { "X-Knowledge-Admin": password } : {} });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "無法載入社群");
    setItems(data.items); setPendingVotes(data.votes || []);
  }
  useEffect(() => {
    if (!clientId || password) return;
    let active = true;
    fetch(base + publicQuery).then(r => r.json()).then(data => { if (active && Array.isArray(data.items)) setItems(data.items); }).catch(() => { if (active) setNotice("社群暫時無法載入"); });
    return () => { active = false; };
  }, [base, clientId, password, publicQuery]);
  useEffect(() => {
    if (!challenge || !captchaReady || !siteKey || !captcha.current || !runtime().turnstile) return;
    widget.current = runtime().turnstile!.render(captcha.current, { sitekey: siteKey, action: "community", callback: setChallengeToken, "expired-callback": () => setChallengeToken("") });
    return () => { runtime().turnstile?.remove(widget.current); widget.current = ""; };
  }, [challenge, captchaReady, siteKey]);
  async function write(path: string, body: Record<string, unknown>, method = "POST") {
    setBusy(true); setNotice("");
    try {
      const response = await fetch(base + path + publicQuery, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(password ? { "X-Knowledge-Admin": password } : {}) }, body: JSON.stringify({ ...body, challenge_token: challengeToken }) });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "challenge_required") setChallenge(true);
        const retry = response.headers.get("Retry-After");
        throw new Error((data.error || "操作失敗") + (retry ? `；請於 ${retry} 秒後重試。` : ""));
      }
      await load();
      setNotice(data.status === "pending" ? "已收到，待檢查；投票尚未計入公開票數。" : "操作已保存。");
      return true;
    } catch (e) { setNotice(e instanceof Error ? e.message : "操作失敗，輸入仍保留。"); return false; }
    finally { setBusy(false); setChallengeToken(""); if (widget.current) runtime().turnstile?.reset(widget.current); }
  }
  if (!clientId && !password) return null;
  return <section aria-label="規則社群" className="card-euro my-6 rounded-lg p-5">
    <h2 className="font-semibold">{password ? "社群審核" : "規則補充與討論"}</h2><p className="my-2 text-sm leading-7">補充與留言是討論資料，未經規則校對及發布，不會影響正式問答。按讚不代表規則正確。</p>
    {!password && <><Script src="https://accounts.google.com/gsi/client" onReady={() => { runtime().google?.accounts.id.initialize({ client_id: clientId!, callback: data => setToken(data.credential) }); if (login.current) runtime().google?.accounts.id.renderButton(login.current, { theme: "outline", size: "large" }); }} /><div ref={login} />{token && <button className="min-h-11 underline" onClick={() => { setToken(""); setMyVotes({}); }}>登出本頁</button>}</>}
    {password && <button disabled={busy} className="btn-euro min-h-11 rounded-lg px-3" onClick={() => void load().catch(e => setNotice(e.message))}>讀取審核佇列</button>}
    {items.map(item => <article key={item.id} className="my-4 border-t border-grid-line pt-4"><p className="whitespace-pre-wrap text-sm leading-7">{item.content}</p><p className="text-xs">{password ? item.status : `${item.votes} 人覺得有幫助`}</p>
      {password ? <div className="flex flex-wrap gap-2">{["visible", "hidden", "rejected"].map(decision => <button key={decision} disabled={busy} className="btn-euro min-h-11 rounded-lg px-3" onClick={() => { const reason = window.prompt("請填寫處置原因"); if (reason) void write("/review", { target: item.id, decision, reason }); }}>{({ visible: "公開討論", hidden: "隱藏", rejected: "駁回" } as Record<string, string>)[decision]}</button>)}{["restrict", "restore"].map(decision => <button key={decision} disabled={busy} className="btn-euro min-h-11 rounded-lg px-3" onClick={() => { const reason = window.prompt("請填寫帳號處置原因"); if (reason) void write("/review", { target: item.id, actor: item.actor, decision, reason }); }}>{decision === "restrict" ? "限制作者" : "恢復作者"}</button>)}</div> : <div className="flex gap-3"><button disabled={!token || busy} className="min-h-11 underline" onClick={() => void write(`/contributions/${item.id}/vote`, { active: !myVotes[item.id] }, "PUT").then(ok => { if (ok) setMyVotes(old => ({ ...old, [item.id]: !old[item.id] })); })}>{myVotes[item.id] ? "取消按讚" : "有幫助"}</button><button className="min-h-11 underline" onClick={() => { setReporting(false); setTarget(item.id); void fetch(`${base}?target=${item.id}${publicRead ? "&public=1" : ""}`).then(r => r.json()).then(data => setComments(data.items || [])).catch(() => setNotice("留言載入失敗")); }}>留言</button><button disabled={!token || busy} className="min-h-11 underline" onClick={() => { setReporting(true); setTarget(item.id); setComments([]); }}>檢舉</button></div>}
    </article>)}
    {password && pendingVotes.map(v => <div key={`${v.actor}:${v.target}`} className="my-3 border-t border-grid-line pt-3"><p className="break-all text-sm">待檢查投票：{v.target} · {v.actor}</p>{["counted", "void"].map(decision => <button key={decision} disabled={busy} className="btn-euro mr-2 min-h-11 rounded-lg px-3" onClick={() => { const reason = window.prompt("請填寫投票處置原因"); if (reason) void write("/review", { ...v, decision, reason }); }}>{decision === "counted" ? "解除暫緩" : "作廢"}</button>)}</div>)}
    {!password && <>{target && <div className="my-4"><h3>{reporting ? "提交檢舉" : "此補充的留言"}</h3>{comments.map(c => <p className="my-2 whitespace-pre-wrap text-sm" key={c.id}>{c.content}<button disabled={!token || busy} className="ml-3 min-h-11 underline" onClick={() => { setReporting(true); setTarget(c.id); setComments([]); }}>檢舉留言</button></p>)}<button className="min-h-11 underline" onClick={() => { setTarget(""); setReporting(false); setComments([]); }}>返回新增補充</button></div>}<label className="block text-sm">{reporting ? "檢舉原因（只交由管理員處理）" : target ? "新增留言" : "提交規則補充（請附規則編號、版本與來源）"}<textarea maxLength={4000} disabled={busy} value={text} className="input-euro mt-2 min-h-28 w-full p-3" onChange={e => setText(e.target.value)} /></label><button className="btn-euro-primary mt-3 min-h-11 rounded-lg px-4" disabled={!token || busy || text.trim().length < 2 || (challenge && !challengeToken)} onClick={() => void write(reporting ? "/reports" : target ? "/comments" : "/contributions", { content: text, target }).then(ok => { if (ok) setText(""); })}>送出{reporting ? "檢舉" : target ? "留言" : "補充"}</button></>}
    {challenge && <div className="my-3">{siteKey ? <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setCaptchaReady(true)} /><div ref={captcha} /></> : <p>機器人驗證尚未設定，請稍後重試；輸入會保留。</p>}</div>}
    {notice && <p role="status" className="my-3 text-sm">{notice}</p>}
  </section>;
}
