import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testMatch:"integration.e2e.ts",
  testIgnore:[],
  timeout:90000,
  outputDir:"../../tmp/verification/integration/results",
  reporter:[["list"],["html",{outputFolder:"../../tmp/verification/integration/report",open:"never"}],["json",{outputFile:"../../tmp/verification/integration/results.json"}]],
  use:{...base.use,baseURL:"http://127.0.0.1:3027",actionTimeout:10000},
  webServer:{command:"node scripts/verification/integration-server.mjs",cwd:"../..",url:"http://127.0.0.1:3027/api/rules/knowledge/session",reuseExistingServer:false,timeout:120000},
});
