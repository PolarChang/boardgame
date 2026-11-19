// Trusted-side planning only. Never imports or executes candidate code.
import { execFileSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

export function planObservation(rules, files, candidate, evidence = null) {
  if (rules.schema !== 1 || rules.mode !== "observe" || !Array.isArray(rules.rules)) throw new Error("Unsupported trusted rule schema/mode");
  const triggered = rules.rules.filter(rule => files.some(file => rule.patterns.some(pattern => new RegExp(pattern).test(file))));
  const checks = [...new Set(triggered.flatMap(rule => rule.checks))].sort();
  const reasons = [];
  if (triggered.some(rule => rule.humanReview)) reasons.push("Verification rules/checks changed: human review required; candidate rules cannot judge themselves");
  const current = evidence?.sha === candidate;
  if (evidence && !current) reasons.push("Evidence belongs to a different candidate SHA");
  const results = Object.fromEntries(checks.map(check => [check,current ? evidence?.checks?.[check] || "NOT_RUN" : "NOT_RUN"]));
  for (const check of checks) if (results[check] !== "PASS") reasons.push(`${check}: ${results[check]}`);
  // PR-produced evidence remains a report, not a trusted attestation of execution.
  if (checks.length && evidence && evidence.provenance !== "trusted-runner") reasons.push("Candidate evidence is untrusted; independent verification remains required");
  return {mode:"observe",candidate,triggeredRules:triggered.map(rule => rule.id),checks:results,wouldBlock:reasons.length > 0,reasons};
}

export async function observe({cwd = process.cwd(),base,candidate,files,evidence,output}) {
  if (!/^[a-f0-9]{40}$/.test(base) || !/^[a-f0-9]{40}$/.test(candidate)) throw new Error("Immutable base and candidate SHAs required");
  const source = execFileSync("git",["show",`${base}:scripts/verification/observe-rules.json`],{cwd,encoding:"utf8"});
  const report = {...planObservation(JSON.parse(source),files,candidate,evidence),base,rulesSha256:createHash("sha256").update(source).digest("hex"),rulesSource:`${base}:scripts/verification/observe-rules.json`};
  await mkdir(dirname(output),{recursive:true}); await writeFile(output,JSON.stringify(report,null,2));
  console.log(`Observe: ${report.wouldBlock ? "would block" : "no missing checks"}; no enforcement; ${output}`);
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const input = process.env.VERIFICATION_OBSERVE_INPUT;
  if (!input) throw new Error("Set VERIFICATION_OBSERVE_INPUT to trusted-event JSON; no working-tree rules fallback");
  const parameters = JSON.parse(await readFile(input,"utf8"));
  await observe({...parameters,output:resolve("tmp/verification/observe/result.json")});
}
