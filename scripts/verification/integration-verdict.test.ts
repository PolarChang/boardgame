import { expect, it } from "vitest";
import { injectIntegrationFault } from "./integration-faults.mjs";
import { judgeIntegrationCalibration, sessionCase, publicationCase } from "./integration-verdict.mjs";

function failedReport(title = sessionCase, message = "F05_ANONYMOUS_SOURCE\nReceived: 200", status = "failed") {
  return {errors:[],stats:{expected:0,unexpected:1,skipped:0},suites:[{specs:[{title,tests:[{projectName:"desktop",results:[{status,retry:0,errors:[{message}]}]}]}]}]};
}
it("counts only the intended assertion in the intended case as a caught defect", () => {
  expect(judgeIntegrationCalibration(failedReport(),1,"anonymous-source")).toBe(true);
  expect(judgeIntegrationCalibration(failedReport(publicationCase,"F05_PUBLISHED_READER"),1,"false-publication")).toBe(true);
  expect(judgeIntegrationCalibration(failedReport(publicationCase),1,"anonymous-source")).toBe(false);
  expect(judgeIntegrationCalibration(failedReport(sessionCase,"browser launch failed"),1,"anonymous-source")).toBe(false);
  expect(judgeIntegrationCalibration(failedReport(sessionCase,"F05_ANONYMOUS_SOURCE Received: 503"),1,"anonymous-source")).toBe(false);
  expect(judgeIntegrationCalibration(failedReport(sessionCase,undefined,"timedOut"),1,"anonymous-source")).toBe(false);
  expect(judgeIntegrationCalibration(failedReport(),0,"anonymous-source")).toBe(false);
  expect(judgeIntegrationCalibration(failedReport(),1,"unknown")).toBe(false);
});
it("rejects skipped checks, infrastructure errors and repeated results", () => {
  const skipped = failedReport(); skipped.stats.skipped = 1;
  expect(judgeIntegrationCalibration(skipped,1,"anonymous-source")).toBe(false);
  const globalError = {...failedReport(),errors:[{message:"server failed"}]};
  expect(judgeIntegrationCalibration(globalError,1,"anonymous-source")).toBe(false);
  const retried = failedReport(); retried.suites[0].specs[0].tests[0].results.push(retried.suites[0].specs[0].tests[0].results[0]);
  expect(judgeIntegrationCalibration(retried,1,"anonymous-source")).toBe(false);
});
it("requires all clean cases across both viewports", () => {
  const report = {errors:[],stats:{expected:4,unexpected:0,skipped:0},suites:[{specs:[sessionCase,publicationCase].map(title => ({title,tests:["desktop","mobile"].map(projectName => ({projectName,results:[{status:"passed",retry:0}]}))}))}]};
  expect(judgeIntegrationCalibration(report,0,"none")).toBe(true);
  report.suites[0].specs[0].tests[1].projectName = "desktop";
  expect(judgeIntegrationCalibration(report,0,"none")).toBe(false);
});
it("refuses unknown or ambiguous mutation targets", () => {
  expect(() => injectIntegrationFault("","unknown")).toThrow();
  expect(() => injectIntegrationFault("","anonymous-source")).toThrow();
  const target = "const savedKey = sessionKey(request);";
  expect(() => injectIntegrationFault(target + target,"anonymous-source")).toThrow();
  expect(injectIntegrationFault(target,"none")).toBe(target);
  expect(injectIntegrationFault(target,"anonymous-source")).toContain('"integration-only"');
});
