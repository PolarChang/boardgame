import { spawn } from "node:child_process";
import { mkdir, readFile, cp, writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const records = [];
const cases = [
  { fault: "none", grep: "F01|F04", expectedFailures: 0 },
  { fault: "ignore-time", grep: "F01", expectedFailures: 1, clue: "驗證長局" },
  { fault: "wrong-source", grep: "F04 reads", expectedFailures: 1, clue: "page-1" },
];
await mkdir(resolve(root, "tmp/verification/calibration"), {recursive:true});
await writeFile(resolve(root, "tmp/verification/calibration/summary.json"), "[]");
for (const item of cases) {
  // A failed startup must never reuse a previous run's verdict.
  await unlink(resolve(root, "tmp/verification/results.json")).catch(error => { if (error.code !== "ENOENT") throw error; });
  const code = await new Promise((done, reject) => {
    const child = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--config", "scripts/verification/playwright.config.ts", "--project", "desktop", "--grep", item.grep], {
      cwd: root, env: {...process.env, VERIFICATION_FAULT:item.fault}, stdio:"inherit", windowsHide:true,
    });
    child.on("error", reject); child.on("exit", done);
  });
  const report = JSON.parse(await readFile(resolve(root, "tmp/verification/results.json"), "utf8"));
  const errors = [];
  function visit(suite) {
    for (const spec of suite.specs || []) for (const test of spec.tests) for (const result of test.results) errors.push(...(result.errors || []).map(error => error.message || ""));
    for (const child of suite.suites || []) visit(child);
  }
  for (const suite of report.suites) visit(suite);
  const pass = item.expectedFailures === 0
    ? code === 0 && report.stats.expected === 3 && report.stats.unexpected === 0
    : code === 1 && report.stats.unexpected === 1 && report.stats.expected === 0 && report.stats.skipped === 0 && errors.some(error => error.includes(item.clue));
  const destination = resolve(root, "tmp/verification/calibration", item.fault);
  await cp(resolve(root, "tmp/verification/report"), destination, {recursive:true});
  await cp(resolve(root, "tmp/verification/results.json"), destination + ".json");
  await cp(resolve(root, "tmp/verification/version.json"), destination + "-version.json");
  records.push({...item, exitCode:code, stats:report.stats, result:pass ? "PASS" : "FAIL"});
  await writeFile(resolve(root, "tmp/verification/calibration/summary.json"), JSON.stringify(records,null,2));
  if (!pass) throw new Error(`Verifier calibration failed: ${item.fault}; inspect preserved report`);
}
console.log("Calibration PASS: clean control passes; both controlled defects detected at the expected assertion.");
