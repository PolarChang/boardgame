import fc from "fast-check";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { normalizeCloudPayloadToSections } from "../../src/lib/picks";

async function main() {
const root = resolve(process.cwd());
const baseRef = process.env.VERIFICATION_BASE || "HEAD";
const seed = Number(process.env.VERIFICATION_SEED || 20261119);
const base = execFileSync("git",["rev-parse","--verify",`${baseRef}^{commit}`],{cwd:root,encoding:"utf8"}).trim();
const source = execFileSync("git",["show",`${base}:src/lib/picks.ts`],{cwd:root,encoding:"utf8"});
const destination = join(root,"tmp/verification/differential");
await mkdir(destination,{recursive:true});
const run = await mkdtemp(join(destination,"run-"));
const baselineFile = join(run,"baseline-picks.ts");
await writeFile(baselineFile,source);
const old = await import(pathToFileURL(baselineFile).href);
const text = fc.array(fc.constantFrom("港","灣","A","é","🚢"," "),{minLength:1,maxLength:20}).map(chars => chars.join(""));
const game = fc.record({name:text,bgg_id:fc.oneof(text,fc.integer()),best_for:fc.array(fc.integer({min:1,max:8}),{maxLength:10}),rating:fc.double({noNaN:true,min:0,max:10}),bgg_rank:fc.integer({min:0,max:100000}),min_players:fc.integer({min:0,max:10}),max_players:fc.integer({min:0,max:15})});
const payload = fc.oneof(fc.array(game,{maxLength:30}),fc.record({games:fc.array(game,{maxLength:30})}),fc.constant(null));
const details = fc.check(fc.property(payload,input => JSON.stringify(old.normalizeCloudPayloadToSections(input)) === JSON.stringify(normalizeCloudPayloadToSections(input))),{seed,numRuns:2000,verbose:true});
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const candidateSource = await readFile(join(root,"src/lib/picks.ts"));
const counterexample = details.counterexample?.[0];
// Negative control: dropping an entire bucket must be detected, never normalized away.
const control = fc.check(fc.property(payload,input => JSON.stringify(old.normalizeCloudPayloadToSections(input)) === JSON.stringify(normalizeCloudPayloadToSections(input).slice(1))),{seed,numRuns:100});
const report = {result:details.failed || !control.failed ? "FAIL" : "PASS",base,seed:details.seed,numRuns:details.numRuns,numShrinks:details.numShrinks,counterexamplePath:details.counterexamplePath,baselineHash:digest(source),candidateHash:digest(candidateSource),normalization:"none",approvedDifferences:[],verifierControl:{caught:control.failed,counterexample:control.counterexample,path:control.counterexamplePath,numShrinks:control.numShrinks},...(details.failed ? {input:counterexample,old:old.normalizeCloudPayloadToSections(counterexample),candidate:normalizeCloudPayloadToSections(counterexample)} : {})};
await writeFile(join(run,"result.json"),JSON.stringify(report,null,2));
await writeFile(join(destination,"latest.json"),JSON.stringify({...report,run},null,2));
console.log(`Differential ${report.result}: ${details.numRuns} inputs against ${base}; seed ${details.seed}; ${run}`);
if (report.result === "FAIL") process.exitCode = 1;
}
main().catch(error => {console.error(error);process.exitCode = 1;});
