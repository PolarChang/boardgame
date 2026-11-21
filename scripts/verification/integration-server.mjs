// Real Next handlers -> real FastAPI -> fresh SQLite/local storage. No model worker.
import { cp, mkdir, mkdtemp, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { injectIntegrationFault, integrationFaults } from "./integration-faults.mjs";

const root = resolve(import.meta.dirname, "../..");
const backend = resolve(process.env.KNOWLEDGE_BACKEND_DIR || join(root, "../BoardGameRules"));
const python = process.env.KNOWLEDGE_PYTHON || join(backend, process.platform === "win32" ? ".venv-cloud/Scripts/python.exe" : ".venv/bin/python");
if (process.env.KNOWLEDGE_VERIFICATION_MODE) throw new Error("This CI slice supports only explicit model-free integration");
const modelMode = false, inventoryMode = false;
const fault = process.env.VERIFICATION_INTEGRATION_FAULT || "none";
if (!integrationFaults.includes(fault) || ((modelMode || inventoryMode) && fault !== "none")) throw new Error("Invalid integration fault/model combination");
const frontPort = modelMode ? 3028 : inventoryMode ? 3038 : 3027, backPort = modelMode ? 8028 : inventoryMode ? 8038 : 8027;
const upstream = `http://127.0.0.1:${backPort}`;
const output = join(root, modelMode ? "tmp/verification/model" : inventoryMode ? "tmp/verification/inventory" : "tmp/verification/integration");
const children = [];
let stopping = false;
function stop() { stopping = true; for (const child of children) child.kill(); }
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, stop);
function start(command, args, cwd, env) {
  const child = spawn(command, args, { cwd, env, stdio:"inherit", windowsHide:true });
  children.push(child);
  child.on("error", error => { console.error(error); process.exitCode = 1; stop(); });
  child.on("exit", code => { if (!stopping) { console.error(`Integration child stopped: ${code}`); process.exitCode = 1; stop(); } });
}
async function ready(url) {
  const deadline = Date.now() + 45000;
  while (!stopping && Date.now() < deadline) {
    try { const response = await fetch(url, { signal:AbortSignal.timeout(1500) }); if (response.ok) return response.json(); } catch {}
    await delay(250);
  }
  throw new Error(`Integration readiness failed: ${url}`);
}
const hashes = {};
async function hashTree(directory, prefix) {
  for (const entry of await readdir(directory, {withFileTypes:true})) {
    if (entry.name === "__pycache__") continue;
    const file = join(directory, entry.name);
    if (entry.isDirectory()) await hashTree(file, prefix);
    else if (entry.isFile()) hashes[`${prefix}/${relative(prefix === "frontend" ? root : backend, file).replaceAll("\\", "/")}`] = createHash("sha256").update(await readFile(file)).digest("hex");
  }
}
try {
  if (!existsSync(python) || !existsSync(join(backend,"tests/rule_knowledge/integration_server.py"))) throw new Error("Missing integration Python/fixture; see docs/knowledge-integration.md");
  for (const port of [frontPort, backPort]) await new Promise((done,reject) => {
    const probe = net.createServer(); probe.once("error",reject); probe.listen(port,"127.0.0.1",() => probe.close(done));
  });
  await mkdir(output, {recursive:true});
  if (modelMode) await writeFile(join(output,"desktop-public-outcome.json"),JSON.stringify({status:"not_run"}));
  const snapshot = await mkdtemp(join(output,"app-"));
  // API handlers are copied unchanged. No environment files, production data or public assets.
  await cp(join(root,"src"),join(snapshot,"src"),{recursive:true,filter:path => !/\.(test|spec)\.[^.]+$/.test(path)});
  for (const file of ["tsconfig.json","tailwind.config.ts","postcss.config.mjs"]) await cp(join(root,file),join(snapshot,file));
  await writeFile(join(snapshot,"package.json"),JSON.stringify({private:true}));
  await writeFile(join(snapshot,"next.config.mjs"),`export default {turbopack:{root:${JSON.stringify(root)}}};`);
  let layout = await readFile(join(snapshot,"src/app/layout.tsx"),"utf8");
  layout = layout.replace(/^import .* from "next\/font\/google";\r?\n/m,"");
  for (const name of ["cinzel","dmSans","cormorant","notoSansTC"]) {
    const pattern = new RegExp(`const ${name} = [\\s\\S]*?\\n\\}\\);`);
    if (!pattern.test(layout)) throw new Error(`Offline font adapter changed: ${name}`);
    layout = layout.replace(pattern,`const ${name} = {variable:""};`);
  }
  await writeFile(join(snapshot,"src/app/layout.tsx"),layout);
  let mutation = null;
  if (fault !== "none") {
    const file = "src/app/api/rules/knowledge/games/[gameId]/editorial/[[...action]]/route.ts";
    const original = await readFile(join(snapshot,file),"utf8");
    const mutated = injectIntegrationFault(original,fault);
    await writeFile(join(snapshot,file),mutated);
    mutation = {file,before:createHash("sha256").update(original).digest("hex"),after:createHash("sha256").update(mutated).digest("hex")};
    await writeFile(join(snapshot,"injected-fault.json"),JSON.stringify({fault,...mutation},null,2));
  }
  await hashTree(join(root,"src"),"frontend");
  await hashTree(join(root,"scripts/verification"),"frontend");
  await hashTree(join(backend,"src"),"backend");
  for (const [base,file] of [[root,"package.json"],[root,"package-lock.json"],[backend,"tests/rule_knowledge/integration_server.py"]]) hashes[file] = createHash("sha256").update(await readFile(join(base,file))).digest("hex");
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|COMSPEC|PATHEXT|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(key)));
  const backendEntry = modelMode ? join(root,"scripts/verification/model_backend.py") : inventoryMode ? join(root,"scripts/verification/inventory_backend.py") : "tests/rule_knowledge/integration_server.py";
  hashes.backendEntry = createHash("sha256").update(await readFile(resolve(backend,backendEntry))).digest("hex");
  start(python,[backendEntry],backend,{
    ...env,PYTHONDONTWRITEBYTECODE:"1",KNOWLEDGE_BACKEND_DIR:backend,KNOWLEDGE_INTEGRATION_BACKEND_PORT:String(backPort),KNOWLEDGE_DISABLE_LOCAL_ENV:"true",
  });
  const health = await ready(upstream + "/health");
  if (health.mode !== (modelMode ? "isolated-model-e2e" : inventoryMode ? "isolated-inventory-control" : "isolated-integration") || health.model_calls_enabled !== modelMode) throw new Error("Backend isolation/model mode did not match explicit test selection");
  const fixture = await ready(upstream + "/integration-fixture");
  await writeFile(join(output,"version.json"),JSON.stringify({
    frontendHead:execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim(),
    backendHead:execFileSync("git",["rev-parse","HEAD"],{cwd:backend,encoding:"utf8"}).trim(),
    snapshot,health,fixture,hashes,fault,mutation,scope:modelMode ? "Real local Next / FastAPI / SQLite / Ollama; source-pinned development example, not held-out quality acceptance" : inventoryMode ? "Real Next / FastAPI / SQLite / core; controlled source selection and inventory response, zero model inference" : "Real local Next API / FastAPI / SQLite; synthetic rules, no model inference",
    adapters:["Google fonts disabled in copied layout only"],
  },null,2));
  start(process.execPath,[join(root,"node_modules/next/dist/bin/next"),"dev",snapshot,"--hostname","127.0.0.1","--port",String(frontPort)],snapshot,{
    ...env,NEXT_TELEMETRY_DISABLED:"1",BOARDGAME_RULES_API_URL:upstream,KNOWLEDGE_PRIVATE_API_URL:upstream,
    KNOWLEDGE_PRIVATE_API_KEY:"integration-only",RULES_API_KEY:"",ADMIN_PASSWORD:"integration-only",KNOWLEDGE_LOCAL_ONLY:"true",
    VERCEL:"0",COMMUNITY_PROXY_SECRET:"integration-only",NEXT_PUBLIC_COMMUNITY_GOOGLE_CLIENT_ID:"",NEXT_PUBLIC_TURNSTILE_SITE_KEY:"",NOTION_TOKEN:"",NOTION_DATABASE_ID:"",
  });
} catch (error) { console.error(error); process.exitCode = 1; stop(); }
