import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const destination = "tmp/verification/ci/result.json";
if (process.argv.includes("--check")) {
  const report = JSON.parse(await readFile(destination,"utf8"));
  if (Object.values(report.checks).some(value => value !== "PASS") || report.sha !== report.testedSha) process.exitCode = 1;
} else {
  const translate = value => value === "success" ? "PASS" : value === "failure" ? "FAIL" : "NOT_RUN";
  const checks = Object.fromEntries([["test","TEST_RESULT"],["lint","LINT_RESULT"],["build","BUILD_RESULT"],["verify:properties","PROPERTY_RESULT"],["verify:differential","DIFFERENTIAL_RESULT"]].map(([check,key]) => [check,translate(process.env[key])]));
  const report = {mode:"observe",profile:"main-bootstrap",provenance:"candidate-workflow",sha:process.env.CANDIDATE_SHA,testedSha:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),checks,notRun:{verify:"Browser harness and updated UI are not on main", "verify:integration":"Adjacent isolated backend is not available in this runner","verify:pdf":"PDF/browser dependencies belong to the pending application change"}};
  await mkdir("tmp/verification/ci",{recursive:true}); await writeFile(destination,JSON.stringify(report,null,2));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,"## Verification candidate (observe)\n\n```json\n"+JSON.stringify(report,null,2)+"\n```\n");
}
