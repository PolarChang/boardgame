import { randomBytes } from "node:crypto";

const sessions = new Map<string, { key: string; expires: number }>();
export const sessionCookie = "knowledge-admin-session";
export function revokeSession(request: Request) {
  const token = request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(sessionCookie + "="))?.slice(sessionCookie.length + 1);
  if (token) sessions.delete(token);
}
export function sessionKey(request: Request) {
  const token = request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(sessionCookie + "="))?.slice(sessionCookie.length + 1);
  if (process.env.VERCEL === "1") return token && /^ksession\.[a-f0-9]{64}$/.test(token) ? token : "";
  const session = token && sessions.get(token);
  if (!session || session.expires <= Date.now()) { if (token) sessions.delete(token); return ""; }
  return session.key;
}
export function createSession(key: string) {
  for (const [id, value] of sessions) if (value.expires <= Date.now()) sessions.delete(id);
  if (sessions.size >= 1000) throw new Error("管理登入工作階段已滿");
  const token = randomBytes(32).toString("hex");
  sessions.set(token, { key, expires: Date.now() + 2 * 60 * 60 * 1000 });
  return token;
}
