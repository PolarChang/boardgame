import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile, cp, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { judgeIntegrationCalibration } from "./integration-verdict.mjs";

const root = resolve(import.meta.dirname,"../..");
const output = join(root,"tmp/verification/integration");
const records = [];
async function main() {
  if (process.env.KNOWLEDGE_VERIFICATION_MODE || process.env.VERIFICATION_INTEGRATION_FAULT) throw new Error("Run calibration without model/fault environment overrides");
  const parent = join(output,"calibration");
  await mkdir(parent,{recursive:true});
  const run = await mkdtemp(join(parent,"run-"));
  const pointer = join(parent,"latest.json");
  const route = join(root,"src/app/api/rules/knowledge/games/[gameId]/editorial/[[...action]]/route.ts");
  const digest = bytes => createHash("sha256").update(bytes).digest("hex");
  const originalHash = digest(await readFile(route));
  let baseline;
  async function record(status, error) {
    const summary = {run,status,records,...(error ? {error} : {})};
    await writeFile(join(run,"summary.json"),JSON.stringify(summary,null,2));
    await writeFile(pointer,JSON.stringify(summary,null,2));
  }
  await record("RUNNING");
  try {
    for (const item of [
      {fault:"none"},
      {fault:"anonymous-source",grep:"F05 real sessions"},
      {fault:"false-publication",grep:"F05 real browser edits"},
    ]) {
      // Missing or stale reports must not supply a previous verdict.
      for (const file of ["results.json","version.json"]) await unlink(join(output,file)).catch(error => {if(error.code !== "ENOENT") throw error;});
      const args = ["node_modules/@playwright/test/cli.js","test","--config","scripts/verification/integration.config.ts"];
      if (item.grep) args.push("--project","desktop","--grep",item.grep);
      const code = await new Promise((done,reject) => {
        const child = spawn(process.execPath,args,{cwd:root,env:{...process.env,KNOWLEDGE_VERIFICATION_MODE:"",VERIFICATION_INTEGRATION_FAULT:item.fault},stdio:"inherit",windowsHide:true});
        child.on("error",reject); child.on("exit",done);
      });
      const report = JSON.parse(await readFile(join(output,"results.json"),"utf8"));
      const version = JSON.parse(await readFile(join(output,"version.json"),"utf8"));
      const hashes = JSON.stringify(Object.entries(version.hashes).sort(([a],[b]) => a.localeCompare(b)));
      baseline ??= hashes;
      const isolated = version.health?.mode === "isolated-integration" && version.health?.model_calls_enabled === false && version.fault === item.fault;
      const mutation = item.fault === "none" ? version.mutation === null : version.mutation?.before === originalHash && version.mutation.after !== originalHash;
      const pass = isolated && mutation && hashes === baseline && judgeIntegrationCalibration(report,code,item.fault) && digest(await readFile(route)) === originalHash;
      const destination = join(run,item.fault);
      await cp(join(output,"report"),join(destination,"report"),{recursive:true});
      await cp(join(output,"results.json"),join(destination,"results.json"));
      await cp(join(output,"version.json"),join(destination,"version.json"));
      if (version.mutation) await cp(join(version.snapshot,version.mutation.file),join(destination,"mutated-route.ts"));
      records.push({...item,exitCode:code,stats:report.stats,result:pass ? "PASS" : "FAIL"});
      await record(pass ? "RUNNING" : "FAIL");
      if (!pass) throw new Error(`F05 calibration rejected: ${item.fault}; see ${destination}`);
    }
    await record("PASS");
    console.log(`F05 calibration PASS: four clean E2Es and two precisely detected defects. Evidence: ${run}`);
  } catch (error) { await record("FAIL",String(error)); throw error; }
}
main().catch(error => {console.error(error);process.exitCode = 1;});
