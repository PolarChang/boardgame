import { it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

it("rejects incomplete browser evidence even when its recorded revision matches", async () => {
  await mkdir("tmp", {recursive:true});
  const cwd=await mkdtemp(resolve("tmp/browser-evidence-"));
  await mkdir(resolve(cwd,"tmp/verification/browser-ci"),{recursive:true});
  const script=resolve("scripts/verification/browser-ci-report.mjs");
  const checks=Object.fromEntries(["backend-unit","verify","verify:calibrate","verify:integration","verify:integration:calibrate","verify:pdf"].map(key=>[key,"PASS"]));
  for(const [report,expected] of [
    [{revisionsMatch:true,checks},0],
    [{revisionsMatch:false,checks},1],
    [{revisionsMatch:true,checks:{}},1],
    [{revisionsMatch:true,checks:{...checks,"verify:pdf":"FAIL"}},1],
    [{revisionsMatch:true,checks:{...checks,"verify:integration":"NOT_RUN"}},1],
  ] as const){
    await writeFile(resolve(cwd,"tmp/verification/browser-ci/result.json"),JSON.stringify(report));
    expect(spawnSync(process.execPath,[script,"--check"],{cwd}).status).toBe(expected);
  }
});
