import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const front = "http://127.0.0.1:3027";
const back = "http://127.0.0.1:8027";
const game = "knowledge-integration";
const base = `/api/rules/knowledge/games/${game}/editorial`;
async function login(page: Page) {
  await page.getByLabel("管理登入密碼", {exact:true}).fill("integration-only");
  await page.getByRole("button", {name:"登入",exact:true}).click();
  await expect(page.getByText("管理員已登入",{exact:true})).toBeVisible();
}

test.beforeEach(async ({context}, info) => {
  await info.attach("tested-version-and-isolated-database", {body:await readFile("tmp/verification/integration/version.json"),contentType:"application/json"});
  // No response mocking. Block external browser traffic only.
  await context.route("**/*", route => new URL(route.request().url()).origin === front ? route.continue() : route.abort("blockedbyclient"));
});

test("F05 real sessions protect private source images and revoke access on logout", async ({page,context,playwright},info) => {
  const metadata = JSON.parse(await readFile("tmp/verification/integration/version.json","utf8"));
  const imported = `${base}/imports/${metadata.fixture.import_id}`;
  const privateImage = `${imported}/pages/1/image?digest=`;
  await test.step("Anonymous direct writes and private reads are rejected", async () => {
    expect((await context.request.post(base + "/drafts",{data:{text:metadata.fixture.text}})).status()).toBe(401);
    expect((await context.request.get(imported + "/locations")).status(), "F05_ANONYMOUS_SOURCE: private locations must reject anonymous access").toBe(401);
  });
  await page.goto(`/knowledge/${game}/manage`);
  await page.getByLabel("管理登入密碼",{exact:true}).fill("incorrect-test-password");
  await page.getByRole("button",{name:"登入",exact:true}).click();
  await expect(page.getByRole("region",{name:"管理登入"}).getByRole("alert")).toBeVisible();
  await login(page);
  const locationsResponse = await context.request.get(imported + "/locations");
  expect(locationsResponse.status()).toBe(200);
  const locations = await locationsResponse.json();
  const image = await context.request.get(privateImage + locations.digest);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");
  expect(image.headers()["cache-control"]).toBe("private, no-store");
  expect((await image.body()).subarray(1,4).toString()).toBe("PNG");
  expect((await context.request.get(privateImage + "0".repeat(64))).status()).toBe(409);
  expect((await context.request.get((privateImage + locations.digest).replace(`/games/${game}/`,"/games/knowledge-integration-other/"))).status()).toBe(404);
  const cookies = await context.cookies();
  await page.getByRole("button",{name:"登出管理存取",exact:true}).click();
  await expect(page.getByLabel("管理登入密碼",{exact:true})).toBeVisible();
  expect((await context.request.get(privateImage + locations.digest)).status()).toBe(401);
  const replay = await playwright.request.newContext({baseURL:front,extraHTTPHeaders:{Cookie:cookies.map(cookie => `${cookie.name}=${cookie.value}`).join("; ")}});
  try { expect((await replay.get(privateImage + locations.digest)).status()).toBe(401); }
  finally { await replay.dispose(); }
  await info.attach("logged-out",{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
});

test("F05 real browser edits, saves and publishes; fresh reader and SQLite readback agree", async ({page,browser,context,playwright},info) => {
  const beforeResponse = await context.request.get(base + "?public=1");
  expect(beforeResponse.status()).toBe(200);
  const before = await beforeResponse.json();
  const title = `支付資源（${info.project.name}整合校驗）`;
  await page.goto(`/knowledge/${game}/manage?step=import`);
  await login(page);
  await page.getByRole("button",{name:"以正式版建立校對稿",exact:true}).click();
  await page.getByRole("button",{name:"備份目前稿並套用匯入",exact:true}).click();
  await page.getByRole("button",{name:"匯入與備份",exact:true}).click();
  const manuscript = page.getByRole("textbox",{name:"整理稿文字",exact:true});
  const originalText = await manuscript.inputValue();
  expect(originalText).toMatch(/標題：支付資源/);
  await manuscript.fill(originalText.replace(/標題：支付資源[^\n]*/,`標題：${title}`));
  await page.getByRole("button",{name:"預覽",exact:true}).click();
  await expect(page.getByRole("button",{name:new RegExp(title.replace(/[（）]/g,"."))})).toBeVisible();
  await page.getByRole("button",{name:"前往發布",exact:true}).click();
  const publish = page.getByRole("button",{name:"發布已確認版本",exact:true});
  await expect(publish).toBeDisabled();
  await page.getByText("只儲存草稿",{exact:true}).click();
  const saveResponsePromise = page.waitForResponse(response => response.url().endsWith(base + "/drafts") && response.request().method() === "POST");
  await page.getByRole("button",{name:"儲存伺服器草稿",exact:true}).click();
  const savedResponse = await saveResponsePromise;
  expect(savedResponse.status()).toBe(200);
  const saved = await savedResponse.json();
  await expect(page.getByText("草稿已儲存到伺服器，尚未發布。",{exact:true})).toBeVisible();
  expect((await (await context.request.get(base + "?public=1")).json()).version).toBe(before.version);
  await page.getByRole("checkbox",{name:"我已逐項核對原文、中文、數字、條件及例外，並確認以上差異可發布。",exact:true}).check();
  const publishResponsePromise = page.waitForResponse(response => response.url().endsWith(base + "/publish") && response.request().method() === "POST");
  await publish.click();
  expect((await publishResponsePromise).status()).toBe(200);
  await expect(page.getByText("正式版本已更新，讀者現在可查詢此版本。",{exact:true})).toBeVisible();
  const fresh = await browser.newContext();
  await fresh.route("**/*",route => new URL(route.request().url()).origin === front ? route.continue() : route.abort("blockedbyclient"));
  try {
    const reader = await fresh.newPage();
    await reader.goto(`${front}/knowledge/${game}/reader?block=R1`);
    await expect(reader.getByRole("heading",{name:title,exact:true}), "F05_PUBLISHED_READER: a fresh reader must see the saved published revision").toBeVisible();
    await reader.reload();
    await expect(reader.getByRole("heading",{name:title,exact:true})).toBeVisible();
    await info.attach("fresh-reader-after-reload",{body:await reader.screenshot({fullPage:true}),contentType:"image/png"});
  } finally { await fresh.close(); }
  const direct = await playwright.request.newContext({baseURL:back});
  try {
    const directResponse = await direct.get(`/api/knowledge/games/${game}/editorial?public=1`);
    expect(directResponse.status()).toBe(200);
    const stored = await directResponse.json();
    expect(stored.version).toBe(saved.version);
    expect(stored.document.blocks.find((block:{id:string}) => block.id === "R1").fields.標題).toBe(title);
    await info.attach("direct-backend-readback",{body:JSON.stringify(stored),contentType:"application/json"});
  } finally { await direct.dispose(); }
  const body = {version:saved.version,expected_version:before.version,confirmed:true};
  // Cookie-authenticated writes without the browser's same-origin header must be rejected.
  expect((await context.request.post(base + "/publish",{data:body})).status()).toBe(403);
  const conflict = await context.request.post(base + "/publish",{headers:{Origin:front},data:body});
  expect(conflict.status()).toBe(409);
});
