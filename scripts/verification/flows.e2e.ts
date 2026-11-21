import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test.beforeEach(async ({ context }, info) => {
  await info.attach("tested-version", { body: await readFile(resolve("tmp/verification/version.json")), contentType: "application/json" });
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    return url.origin === "http://127.0.0.1:3026" ? route.continue() : route.abort("blockedbyclient");
  });
});

test("F01 finds the exact set and preserves it across views", async ({ page }, info) => {
  await test.step("Open collection and set four players / sixty minutes", async () => {
    await page.goto("/");
    if (info.project.name === "mobile") await page.getByRole("button", { name: "篩選條件", exact:true }).click();
    await page.getByRole("button", { name: "4人", exact: true }).click();
    await page.getByRole("slider", { name: /最長時間/ }).fill("60");
  });
  for (const title of ["網格", "卡片", "清單"]) {
    await test.step(`Check exact game set in ${title}`, async () => {
      await page.getByTitle(title, { exact: true }).click();
      await expect(page.getByTestId("game-grid-section").getByRole("heading")).toHaveText(["驗證港灣", "驗證草原"]);
    });
  }
  await test.step("No-result search can be cleared", async () => {
    await page.getByPlaceholder("搜尋桌遊名稱（中文/英文）...").fill("不存在的遊戲");
    await expect(page.getByText(/找不到符合「不存在的遊戲」/)).toBeVisible();
    await page.getByTitle("清除搜尋", {exact:true}).click();
    await expect(page.getByTestId("game-grid-section").getByRole("heading")).toHaveText(["驗證港灣", "驗證草原"]);
  });
  await info.attach("completed-flow", {body:await page.screenshot({fullPage:true}),contentType:"image/png"});
});

test("F04 reads a rule, checks the original and returns", async ({ page, context }, info) => {
  await page.goto("/knowledge");
  await page.getByLabel("搜尋遊戲", {exact:true}).fill("港灣");
  await page.getByRole("link", {name:"驗證港灣",exact:true}).click();
  await page.getByLabel("搜尋規則或 FAQ").fill("港口移動");
  await page.getByRole("button", {name:/規則 · R1/}).click();
  await expect(page.getByRole("heading", {name:"港口移動",exact:true})).toBeVisible();
  await page.getByRole("link", {name:"看原文 · 第 2 頁",exact:true}).click();
  await expect(page).toHaveURL(/page=2.*block=R1.*version=verification-v1/);
  const popupPromise = context.waitForEvent("page");
  await page.getByRole("link", {name:"開啟原書來源 ↗",exact:true}).click();
  const original = await popupPromise;
  await original.waitForLoadState();
  await expect(original).toHaveURL(/verification-source#page-2$/);
  await expect(original.getByRole("heading", {name:"港灣測試原書 · 測試版一",exact:true})).toBeVisible();
  await expect(original.locator(":target")).toContainText("Move exactly two spaces each turn.");
  await info.attach("original-page", {body:await original.screenshot({fullPage:true}),contentType:"image/png"});
  await original.close();
  await page.getByRole("link", {name:"← 查規則",exact:true}).click();
  await expect(page.getByRole("heading", {name:"港口移動",exact:true})).toBeVisible();
});

test("F04 rejects stale source versions and handles unpublished games", async ({ page }) => {
  await page.goto("/knowledge/harbor/reader/source?block=R1&page=2&version=old-version");
  await expect(page.getByText("規則已更新。請回到「查規則」重新開啟原文。")).toBeVisible();
  await expect(page.getByRole("link", {name:"開啟原書來源 ↗"})).toHaveCount(0);
  await page.goto("/knowledge/unpublished/reader");
  await expect(page.getByRole("heading", {name:"規則尚未發布"})).toBeVisible();
});
