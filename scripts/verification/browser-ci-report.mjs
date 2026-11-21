import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const file="tmp/verification/browser-ci/result.json";
const required=["backend-unit","verify","verify:calibrate","verify:integration","verify:integration:calibrate","verify:pdf"];
if(process.argv.includes("--check")){
 const report=JSON.parse(await readFile(file,"utf8"));
 if(report.revisionsMatch!==true||required.some(key=>report.checks?.[key]!=="PASS"))process.exitCode=1;
}else{
 const lock=JSON.parse(await readFile("scripts/verification/backend-lock.json","utf8"));
 const testedSha=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
 const backendSha=execFileSync("git",["rev-parse","HEAD"],{cwd:process.env.KNOWLEDGE_BACKEND_DIR,encoding:"utf8"}).trim();
 const translate=value=>value==="success"?"PASS":value==="failure"?"FAIL":"NOT_RUN";
 const checks=Object.fromEntries([["backend-unit","BACKEND_RESULT"],["verify","FIXTURE_RESULT"],["verify:calibrate","FIXTURE_CALIBRATION_RESULT"],["verify:integration","INTEGRATION_RESULT"],["verify:integration:calibrate","INTEGRATION_CALIBRATION_RESULT"],["verify:pdf","PDF_RESULT"]].map(([key,name])=>[key,translate(process.env[name])]));
 const report={mode:"observe",provenance:"candidate-workflow",sha:process.env.CANDIDATE_SHA,testedSha,backendSha,backendExpected:lock.commit,revisionsMatch:process.env.CANDIDATE_SHA===testedSha&&backendSha===lock.commit,checks,notRun:{"model-quality":"No model consumer or inference is authorized","inventory-control":"Separate ongoing work is outside this slice","Hegemony-page-replay":"Original page image and saved-answer replay are not published in this slice"}};
 await mkdir("tmp/verification/browser-ci",{recursive:true});await writeFile(file,JSON.stringify(report,null,2));
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,"## Browser verification (observe)\n\n```json\n"+JSON.stringify(report,null,2)+"\n```\n");
}
