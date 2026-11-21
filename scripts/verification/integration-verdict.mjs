export const sessionCase = "F05 real sessions protect private source images and revoke access on logout";
export const publicationCase = "F05 real browser edits, saves and publishes; fresh reader and SQLite readback agree";

export function judgeIntegrationCalibration(report, exitCode, fault) {
  const tests = [];
  function visit(suite) {
    for (const spec of suite.specs || []) for (const test of spec.tests || []) tests.push({title:spec.title,...test});
    for (const child of suite.suites || []) visit(child);
  }
  for (const suite of report.suites || []) visit(suite);
  if ((report.errors || []).length || tests.some(test => test.results?.length !== 1)) return false;
  if (fault === "none") {
    const expected = ["desktop","mobile"].flatMap(project => [sessionCase,publicationCase].map(title => `${project}:${title}`)).sort();
    return exitCode === 0 && report.stats?.expected === 4 && report.stats?.unexpected === 0 && report.stats?.skipped === 0
      && JSON.stringify(tests.map(test => `${test.projectName}:${test.title}`).sort()) === JSON.stringify(expected)
      && tests.every(test => test.results[0].status === "passed" && test.results[0].retry === 0);
  }
  const marker = fault === "anonymous-source" ? "F05_ANONYMOUS_SOURCE" : fault === "false-publication" ? "F05_PUBLISHED_READER" : null;
  if (!marker || exitCode !== 1 || tests.length !== 1 || report.stats?.unexpected !== 1 || report.stats?.expected !== 0 || report.stats?.skipped !== 0) return false;
  const test = tests[0], result = test.results[0];
  const title = fault === "anonymous-source" ? sessionCase : publicationCase;
  const errors = (result.errors || []).map(error => error.message || "").join("\n").replace(/\u001b\[[0-9;]*m/g, "");
  return test.projectName === "desktop" && test.title === title && result.status === "failed" && result.retry === 0 && errors.includes(marker)
    && (fault !== "anonymous-source" || /Received:\s*200/.test(errors));
}
