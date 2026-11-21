import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Manager from "./page";
vi.mock("next/navigation", () => ({ useParams: () => ({ gameId: "test-game" }) }));
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("React", React);
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ version: "", document: null }) })));
});
afterEach(() => { window.history.replaceState(null, "", "/"); cleanup(); vi.unstubAllGlobals(); });
describe("editorial management", () => {
  it("opens the source workspace with instructions collapsed", async () => {
    render(<Manager />);
    await screen.findByText(/目前正式版：尚未發布/);
    expect(screen.getByRole("button", { name: "匯入 PDF／圖片" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: "匯入規則書" })).toBeVisible();
    expect(screen.getByRole("button", { name: "登入" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "重新整理匯入任務" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "檢查整理稿（不使用 AI）" })).not.toBeInTheDocument();
    expect(screen.getByText("格式與處理提示").closest("details")).not.toHaveAttribute("open");
  });
  it("reveals file controls after restoring a management session", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith("/session") ? { authenticated: true } : { version: "", document: null } })));
    render(<Manager />);
    expect(await screen.findByRole("button", { name: "重新整理匯入任務" })).toBeEnabled();
    expect(screen.getByText("格式與處理提示").closest("details")).not.toHaveAttribute("open");
  });
  it("reloads the selected editor fields after explicitly replacing a draft", async () => {
    window.history.replaceState(null, "", "/knowledge/test-game/manage?block=R1");
    localStorage.setItem("knowledge-editorial-draft:v1:test-game", "# 規則整理稿 v1\n## 規則 R1\n標題：舊標題\n狀態：待確認");
    vi.stubGlobal("fetch", vi.fn(async () => ({ok:true,json:async () => ({version:"release-1",document:{blocks:[{kind:"規則",id:"R1",fields:{標題:"新標題",狀態:"已確認"}}]}})})));
    render(<Manager />);
    expect(screen.getByLabelText("標題")).toHaveValue("舊標題");
    fireEvent.click(screen.getByRole("button", {name:"匯入與備份"}));
    fireEvent.click(await screen.findByRole("button", {name:"以正式版建立校對稿"}));
    fireEvent.click(screen.getByRole("button", {name:"備份目前稿並套用匯入"}));
    expect(screen.getByLabelText("標題")).toHaveValue("新標題");
    expect(screen.getByRole("button", {name:"匯入與備份"})).toBeEnabled();
    window.history.replaceState(null, "", "/");
  });
  it("previews a released document before replacing and backing up the local draft", async () => {
    const original = "# 規則整理稿 v1\n## 文件 META\n遊戲：舊稿\n版本：舊版";
    localStorage.setItem("knowledge-editorial-draft:v1:test-game", original);
    vi.stubGlobal("fetch", vi.fn(async () => ({ok:true,json:async () => ({version:"release-1",document:{blocks:[{kind:"文件",id:"META",fields:{遊戲:"測試",版本:"新版"}}]}})})));
    render(<Manager />);
    fireEvent.click(screen.getByRole("button", {name:"匯入與備份"}));
    fireEvent.click(await screen.findByRole("button", {name:"以正式版建立校對稿"}));
    expect(localStorage.getItem("knowledge-editorial-draft:v1:test-game")).toBe(original);
    fireEvent.click(screen.getByRole("button", {name:"備份目前稿並套用匯入"}));
    expect(localStorage.getItem("knowledge-editorial-draft:v1:test-game:before-import")).toBe(original);
    expect(localStorage.getItem("knowledge-editorial-draft:v1:test-game")).toContain("版本：新版");
    expect(screen.getByRole("button", {name:/^校對$/})).toHaveAttribute("aria-pressed", "true");
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => !String(url).endsWith("/session"))).toHaveLength(1);
  });
  it("blocks incomplete content and never publishes during validation", async () => {
    render(<Manager />);
    fireEvent.click(screen.getByRole("button", { name: "匯入與備份" }));
    await screen.findByText(/目前正式版：尚未發布/);
    fireEvent.change(screen.getByLabelText("整理稿文字"), { target: { value: "# 規則整理稿 v1\n## 文件 META\n遊戲：測試\n版本：1" } });
    fireEvent.click(screen.getByRole("button", { name: "檢查整理稿（不使用 AI）" }));
    expect(screen.getAllByText("規則：缺少規則段落").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "版本與發布" }));
    expect(screen.getByRole("button", { name: "發布已確認版本" })).toBeDisabled();
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => !String(url).endsWith("/session"))).toHaveLength(1);
  });
  it("retains edited draft across page remounts without storing the password", async () => {
    render(<Manager />);
    fireEvent.click(screen.getByRole("button", { name: "匯入與備份" }));
    await screen.findByText(/目前正式版：尚未發布/);
    fireEvent.change(screen.getByLabelText("整理稿文字"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "檢查整理稿（不使用 AI）" }));
    expect(screen.getByRole("heading", { name: "預覽讀者畫面" })).toBeVisible();
    fireEvent.change(screen.getByLabelText("整理稿文字"), { target: { value: "changed" } });
    fireEvent.change(screen.getByLabelText("管理密碼"), { target: { value: "private-secret" } });
    cleanup();
    render(<Manager />);
    expect(screen.getByLabelText("整理稿文字")).toHaveValue("changed");
    expect(screen.getByLabelText("管理密碼")).toHaveValue("");
    expect(screen.getByRole("heading", { name: "預覽讀者畫面" })).toBeVisible();
  });
});

it("stages imports, preserves the original, and backs it up before applying", async () => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ version: "", document: null }) })));
  localStorage.setItem("knowledge-editorial-draft:v1:test-game", "original draft");
  render(<Manager />);
  fireEvent.click(screen.getByRole("button", { name: "匯入與備份" }));
  const file = new File(["replacement"], "new.md", { type: "text/markdown" });
  Object.defineProperty(file, "text", { value: async () => "replacement" });
  fireEvent.change(screen.getByLabelText("選取 .md / .txt 整理稿"), { target: { files: [file] } });
  await screen.findByRole("region", { name: "匯入預覽" });
  expect(localStorage.getItem("knowledge-editorial-draft:v1:test-game")).toBe("original draft");
  fireEvent.click(screen.getByRole("button", { name: "備份目前稿並套用匯入" }));
  expect(localStorage.getItem("knowledge-editorial-draft:v1:test-game:before-import")).toBe("original draft");
  expect(localStorage.getItem("knowledge-editorial-draft:v1:test-game")).toBe("replacement");
});

it("saves automatically on publish and reuses the saved draft when retrying", async () => {
  const text = `# 規則整理稿 v1
## 文件 META
遊戲：測試遊戲
版本：1.0
## 來源 SRC-1
名稱：原始規則
版本：1.0
PDF頁數：1
## 術語 TERM-1
中文：資源
原文：Resource
別名：物資
## 規則 R-1
大項：進行遊戲
標題：支付資源
角色：工人
人數：3,4
擴充：基本遊戲
內容：支付 2.5 資源。
不可支付負數。
條件：輪到你的回合
例外：無
來源：SRC-1
PDF頁碼：1
原文：Pay 2.5 resources. Do not pay a negative amount.
狀態：已確認
## 涵蓋 C-1
章節：行動
來源：SRC-1
PDF頁碼：1
規則：R-1
狀態：已整理`;
  localStorage.setItem("knowledge-editorial-draft:v1:test-game", text);
  const writes: string[] = [];
  let publishAttempts = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
    if (options?.method === "POST") {
      writes.push(url.split("/").at(-1)!);
      if (url.endsWith("/drafts")) return { ok: true, json: async () => ({ version: "draft-1" }) };
      if (++publishAttempts === 1) return { ok: false, json: async () => ({ error: "請重試發布" }) };
      return { ok: true, json: async () => ({ version: "draft-1" }) };
    }
    return { ok: true, json: async () => ({ version: "", document: null }) };
  }));
  render(<Manager />);
  fireEvent.click(screen.getByRole("button", { name: "匯入與備份" }));
  await screen.findByText(/目前正式版：尚未發布/);
  fireEvent.change(screen.getByLabelText("管理密碼"), { target: { value: "test" } });
  fireEvent.click(screen.getByRole("button", { name: "版本與發布" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /已逐項核對/ }));
  fireEvent.click(screen.getByRole("button", { name: "發布已確認版本" }));
  await screen.findByText("請重試發布");
  fireEvent.click(screen.getByRole("button", { name: "發布已確認版本" }));
  await screen.findByText(/正式版本已更新/);
  expect(writes).toEqual(["drafts", "publish", "publish"]);
});
