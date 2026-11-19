import { expect, it } from "vitest";
import { mkdtemp, writeFile, mkdir, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { observe, planObservation } from "./observe.mjs";

const sha = "a".repeat(40);
const rules = {schema:1,mode:"observe",rules:[{id:"code",patterns:["^src/"],checks:["test"]},{id:"rules",patterns:["^scripts/verification/"],checks:[],humanReview:true}]};
it("marks missing, stale and untrusted evidence without enforcing a gate",() => {
  expect(planObservation(rules,["src/a.ts"],sha).wouldBlock).toBe(true);
  expect(planObservation(rules,["src/a.ts"],sha,{sha:"b".repeat(40),checks:{test:"PASS"}}).wouldBlock).toBe(true);
  expect(planObservation(rules,["src/a.ts"],sha,{sha,checks:{test:"PASS"}}).wouldBlock).toBe(true);
  expect(planObservation(rules,["src/a.ts"],sha,{sha,checks:{test:"PASS"},provenance:"trusted-runner"}).wouldBlock).toBe(false);
  expect(planObservation(rules,["scripts/verification/x"],sha).wouldBlock).toBe(true);
  expect(planObservation(rules,["docs/notes.md"],sha).mode).toBe("observe");
});
it("reads the immutable base rules even when the candidate deletes every rule",async () => {
  await mkdir("tmp/verification",{recursive:true});
  const cwd = await mkdtemp(resolve("tmp/verification/trusted-rules-"));
  const git = (...args:string[]) => execFileSync("git",args,{cwd,encoding:"utf8"}).trim();
  git("init","--quiet"); await mkdir(join(cwd,"scripts/verification"),{recursive:true});
  const file = join(cwd,"scripts/verification/observe-rules.json");
  await writeFile(file,JSON.stringify(rules)); git("add",".");
  git("-c","user.name=Verification","-c","user.email=verification@example.invalid","commit","--quiet","-m","Trusted rules");
  const base = git("rev-parse","HEAD");
  await writeFile(file,JSON.stringify({...rules,rules:[]})); git("add",".");
  git("-c","user.name=Verification","-c","user.email=verification@example.invalid","commit","--quiet","-m","Attempt to weaken candidate rules");
  const candidate = git("rev-parse","HEAD");
  const output = join(cwd,"report.json");
  await observe({cwd,base,candidate,files:["src/a.ts","scripts/verification/observe-rules.json"],output});
  const report = JSON.parse(await readFile(output,"utf8"));
  expect(report.checks.test).toBe("NOT_RUN");
  expect(report.wouldBlock).toBe(true);
  expect(report.rulesSource.startsWith(base)).toBe(true);
  await expect(observe({cwd,base:"HEAD",candidate,files:[],output})).rejects.toThrow("Immutable");
});
