// Disposable Next application snapshot. No production API handlers or credentials.
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import net from "node:net";
import { games, release, sourceHtml } from "./fixtures.mjs";

const root = resolve(import.meta.dirname, "../..");
const port = 3026;
await new Promise((done, reject) => {
  const probe = net.createServer();
  probe.once("error", reject);
  probe.listen(port, "127.0.0.1", () => probe.close(done));
});
const fault = process.env.VERIFICATION_FAULT || "none";
if (!["none", "ignore-time", "wrong-source"].includes(fault)) throw new Error("Unknown calibration fault");
await mkdir(join(root, "tmp/verification"), { recursive: true });
const snapshot = await mkdtemp(join(root, "tmp/verification/app-"));
const hashes = {};
await cp(join(root, "src"), join(snapshot, "src"), { recursive: true, filter: async path => {
  const relative = path.slice(root.length + 1).replaceAll("\\", "/");
  if (relative === "src/app/api" || /\.(test|spec)\.[^.]+$/.test(path)) return false;
  try { const bytes = await readFile(path); hashes[relative] = createHash("sha256").update(bytes).digest("hex"); } catch (error) { if (error.code !== "EISDIR" && error.code !== "EPERM") throw error; }
  return true;
} });
for (const file of ["tsconfig.json", "tailwind.config.ts", "postcss.config.mjs"]) {
  await cp(join(root, file), join(snapshot, file));
  hashes[file] = createHash("sha256").update(await readFile(join(root,file))).digest("hex");
}
for (const file of ["package.json", "package-lock.json", "scripts/verification/fixtures.mjs", "scripts/verification/flows.e2e.ts", "scripts/verification/playwright.config.ts", "scripts/verification/server.mjs", "scripts/verification/calibrate.mjs"]) {
  hashes[file] = createHash("sha256").update(await readFile(join(root,file))).digest("hex");
}
await writeFile(join(snapshot, "package.json"), JSON.stringify({ private: true }));
await writeFile(join(snapshot, "next.config.mjs"), `export default { experimental: { externalDir: true }, turbopack: { root: ${JSON.stringify(root)} } };`);
// Keep the real Home logic; swap only its external data adapter.
const home = await readFile(join(snapshot, "src/app/page.tsx"), "utf8");
if (!home.includes('from "@/lib/notion"')) throw new Error("Home adapter changed; review isolation before continuing");
await writeFile(join(snapshot, "src/app/page.tsx"), home.replace('from "@/lib/notion"', 'from "@/lib/verification-data"'));
await writeFile(join(snapshot, "src/lib/verification-data.ts"), `export async function getGamesFromNotion() { return ${JSON.stringify(games)}; }`);
// Avoid font downloads; retain the real layout, navigation and CSS. Not a typography test.
let layout = await readFile(join(snapshot, "src/app/layout.tsx"), "utf8");
layout = layout.replace(/^import .* from "next\/font\/google";\r?\n/m, "");
for (const name of ["cinzel", "dmSans", "cormorant", "notoSansTC"]) {
  const pattern = new RegExp(`const ${name} = [\\s\\S]*?\\n\\}\\);`);
  if (!pattern.test(layout)) throw new Error(`Font adapter changed: ${name}`);
  layout = layout.replace(pattern, `const ${name} = { variable: "" };`);
}
await writeFile(join(snapshot, "src/app/layout.tsx"), layout);
if (fault === "ignore-time") {
  const file = join(snapshot, "src/components/GameGallery.tsx");
  const source = await readFile(file, "utf8");
  const trigger = "game.playTime !== 0 && game.playTime > maxPlayTime";
  if (!source.includes(trigger)) throw new Error("Calibration mutation no longer matches");
  await writeFile(file, source.replace(trigger, "false"));
}
const published = release(`http://127.0.0.1:${port}`);
if (fault === "wrong-source") published.document.blocks.find(block => block.id === "S1").fields.網址 = `http://127.0.0.1:${port}/verification-source#page-1`;
const api = join(snapshot, "src/app/api/[...path]");
await mkdir(api, { recursive: true });
await writeFile(join(api, "route.ts"), `export async function GET(request: Request) {
 const p = new URL(request.url).pathname;
 if (p === '/api/rules/knowledge/games') return Response.json({games:[{id:'harbor',name:'驗證港灣'}]});
 if (p === '/api/rules/knowledge/games/harbor/editorial') return Response.json(${JSON.stringify(published)});
 return Response.json({error:'Isolated fixture: no handler'}, {status:404});
}
export async function POST(request: Request) {
 return Response.json({error:'Writes disabled'}, {status:403});
}
export const PUT = POST, PATCH = POST, DELETE = POST;`);
await mkdir(join(snapshot, "src/app/verification-source"), { recursive: true });
await writeFile(join(snapshot, "src/app/verification-source/route.ts"), `export function GET() { return new Response(${JSON.stringify(sourceHtml)}, {headers:{'content-type':'text/html; charset=utf-8'}}); }`);
const metadata = { head: execFileSync("git", ["rev-parse", "HEAD"], {cwd:root, encoding:"utf8"}).trim(),
  scope: "browser E2E with fixture adapters; not real backend integration", snapshot, fault, sourceHashes: hashes,
  fixtureHash: createHash("sha256").update(JSON.stringify({games, release:published,sourceHtml})).digest("hex"),
  adapters: ["Home data import", "Google fonts disabled", "API handlers replaced", "synthetic HTML original"] };
await writeFile(join(root, "tmp/verification/version.json"), JSON.stringify(metadata, null, 2));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|COMSPEC|PATHEXT|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(key)));
const child = spawn(process.execPath, [join(root,"node_modules/next/dist/bin/next"), "dev", snapshot, "--hostname", "127.0.0.1", "--port", String(port)], { cwd: snapshot, env: {...env, NEXT_TELEMETRY_DISABLED:"1"}, stdio:"inherit", windowsHide:true });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill());
child.on("error", error => { console.error(error); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
