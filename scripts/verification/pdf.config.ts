import { defineConfig } from "@playwright/test";
import integration from "./integration.config";
export default defineConfig({
  ...integration,testMatch:"pdf.e2e.ts",testIgnore:[],
  use:{...integration.use,channel:"chromium"},
  outputDir:"../../tmp/verification/pdf/results",
  reporter:[["list"],["html",{outputFolder:"../../tmp/verification/pdf/report",open:"never"}],["json",{outputFile:"../../tmp/verification/pdf/results.json"}]],
});
