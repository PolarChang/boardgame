import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("F04 opens the actual original PDF in Chromium",async ({page,context},info) => {
  const bytes = await readFile("tmp/verification/integration/version.json");
  const metadata = JSON.parse(bytes.toString());
  await info.attach("tested-version",{body:bytes,contentType:"application/json"});
  await page.goto("/knowledge/knowledge-integration/manage");
  await page.getByLabel("管理登入密碼",{exact:true}).fill("integration-only");
  await page.getByRole("button",{name:"登入",exact:true}).click();
  await expect(page.getByText("管理員已登入",{exact:true})).toBeVisible();
  const source = `/api/rules/knowledge/games/knowledge-integration/editorial/imports/${metadata.fixture.import_id}/source?inline=1`;
  const response = await context.request.get(source);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  expect((await response.body()).subarray(0,5).toString()).toBe("%PDF-");
  await page.goto(`/knowledge/knowledge-integration/imports/${metadata.fixture.import_id}/source`);
  await page.getByRole("spinbutton",{name:/頁碼/}).fill("2");
  await page.getByRole("button",{name:"放大",exact:true}).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button",{name:"放大圖片",exact:true}).click();
  await expect(dialog.getByText("150%",{exact:true})).toBeVisible();
  const popup = context.waitForEvent("page");
  await dialog.getByRole("link",{name:"開啟來源 PDF ↗",exact:true}).click();
  let pdf = await popup;
  await expect(pdf).toHaveURL(/inline=1#page=2$/);
  await expect.poll(() => pdf.frames().some(frame => frame.url().startsWith("chrome-extension://"))).toBe(true);
  let viewer = pdf.frames().find(frame => frame.url().startsWith("chrome-extension://"))!;
  await expect(viewer.locator("pdf-viewer")).toBeVisible();
  // Chrome localizes its toolbar; these IDs were inspected in the native viewer trace.
  let selector = viewer.locator("#pageSelector");
  await expect(selector).toHaveValue("2");
  await info.attach("rendered-page-two",{body:await pdf.screenshot(),contentType:"image/png"});
  if (info.project.name === "desktop") {
    await selector.fill("3"); await selector.press("Enter");
    await expect(selector).toHaveValue("3");
    await expect(viewer.locator("viewer-thumbnail[is-active]")).toHaveAttribute("aria-label",/3/);
    const zoom = viewer.locator('input[value="100%"]');
    await zoom.fill("150%"); await zoom.press("Enter");
    await expect(zoom).toHaveValue("150%");
    // Chrome preserves viewport position on zoom; the most-visible-page indicator may change.
    // Re-anchor with the visible page control, then verify page 3 at the new zoom as well.
    await selector.fill("3"); await selector.press("Enter");
    await expect(viewer.locator("viewer-thumbnail[is-active]")).toHaveAttribute("aria-label",/3/);
    await expect(zoom).toHaveValue("150%");
  } else {
    // Chrome ignores hash-only navigation in an already loaded PDF. Use the site's next-page
    // control and its actual target=_blank source link, as a narrow-screen reader would.
    await pdf.close();
    await dialog.getByRole("button",{name:"關閉原圖，返回閱讀",exact:true}).click();
    await page.getByRole("button",{name:"下一頁",exact:true}).click();
    await expect(page.getByRole("spinbutton",{name:/頁碼/})).toHaveValue("3");
    await page.getByRole("button",{name:"放大",exact:true}).click();
    const nextPopup = context.waitForEvent("page");
    await dialog.getByRole("link",{name:"開啟來源 PDF ↗",exact:true}).click();
    const thirdPage = await nextPopup;
    await expect(thirdPage).toHaveURL(/inline=1#page=3$/);
    await expect.poll(() => thirdPage.frames().some(frame => frame.url().startsWith("chrome-extension://"))).toBe(true);
    viewer = thirdPage.frames().find(frame => frame.url().startsWith("chrome-extension://"))!;
    selector = viewer.locator("#pageSelector");
    await expect(selector).toHaveValue("3");
    await info.attach("rendered-page-three",{body:await thirdPage.screenshot(),contentType:"image/png"});
    pdf = thirdPage;
  }
  await expect(selector).toHaveValue("3");
  await info.attach("pdf-viewer-dom",{body:await viewer.locator("body").innerHTML(),contentType:"text/html"});
  if (!pdf.isClosed()) {
    await info.attach("rendered-original-pdf",{body:await pdf.screenshot(),contentType:"image/png"});
    await pdf.close();
  }
  await dialog.getByRole("button",{name:"關閉原圖，返回閱讀",exact:true}).click();
  await expect(page.getByRole("button",{name:"放大",exact:true})).toBeVisible();
});
