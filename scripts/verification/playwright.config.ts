import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "flows.e2e.ts",
  testIgnore: ["integration.e2e.ts", "model.e2e.ts", "pdf.e2e.ts", "inventory.e2e.ts"],
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 45000,
  expect: { timeout: 10000 },
  globalTimeout: 300000,
  outputDir: "../../tmp/verification/results",
  reporter: [["list"], ["html", { outputFolder: "../../tmp/verification/report", open: "never" }], ["json", { outputFile: "../../tmp/verification/results.json" }]],
  use: { baseURL: "http://127.0.0.1:3026", trace: "retain-on-failure", screenshot: "only-on-failure", serviceWorkers: "block" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: { command: "node scripts/verification/server.mjs", cwd: "../..", url: "http://127.0.0.1:3026", reuseExistingServer: false, timeout: 120000 },
});
