import { expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { resolve } from "node:path";

it("rejects failed, missing and wrong-commit candidate evidence",async () => {
  await mkdir("tmp",{recursive:true});
  const cwd = await mkdtemp(resolve("tmp/ci-report-"));
  const script = resolve("scripts/verification/ci-report.mjs");
  const sha = execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
  const successful = {CANDIDATE_SHA:sha,TEST_RESULT:"success",LINT_RESULT:"success",BUILD_RESULT:"success",PROPERTY_RESULT:"success",DIFFERENTIAL_RESULT:"success"};
  for (const [changes,expected] of [[{},0],[{TEST_RESULT:"failure"},1],[{TEST_RESULT:"skipped"},1],[{CANDIDATE_SHA:"0".repeat(40)},1]] as const) {
    const env = {...process.env,...successful,...changes,GITHUB_STEP_SUMMARY:""};
    expect(spawnSync(process.execPath,[script],{cwd,env}).status).toBe(0);
    expect(spawnSync(process.execPath,[script,"--check"],{cwd,env}).status).toBe(expected);
  }
  const report = JSON.parse(await readFile(resolve(cwd,"tmp/verification/ci/result.json"),"utf8"));
  expect(report.provenance).toBe("candidate-workflow");
  expect(report.notRun["verify:integration"]).toBeTruthy();
});
