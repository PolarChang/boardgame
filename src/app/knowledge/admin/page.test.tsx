import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import KnowledgePage from "./page";

const games = [
  { id: "brass", name: "Brass", status: "draft", player_count: { min: 2, max: 4 }, play_time: { min: 60, max: 120 } },
  { id: "ark", name: "Ark Nova", status: "published", player_count: { min: 1, max: 4 }, play_time: { min: 90, max: 150 } },
];

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith("/session") ? { authenticated: false } : ({ games: url.endsWith("notion-games") ? [] : games }) })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("KnowledgePage", () => {
  it("clears private games on logout and offers the shared login entry", async () => {
    let active = true;
    vi.mocked(fetch).mockImplementation(async (input, options) => {
      const url = String(input);
      if (url.endsWith("/session")) {
        if (options?.method === "DELETE") active = false;
        return { ok: true, json: async () => ({ authenticated: active }) } as Response;
      }
      return { ok: !url.endsWith("/games") || active, status: active ? 200 : 401, json: async () => url.endsWith("notion-games") ? { games: [] } : active ? { games } : { error: "unauthorized" } } as Response;
    });
    render(<KnowledgePage />);
    await screen.findByText("Ark Nova");
    fireEvent.click(screen.getByText("管理員登入"));
    fireEvent.click(await screen.findByRole("button", { name: "登出管理存取" }));
    expect(await screen.findByLabelText("管理登入密碼")).toBeInTheDocument();
    await screen.findByText("請先登入，讀取你的私人規則庫。");
    expect(screen.queryByText("Ark Nova")).not.toBeInTheDocument();
  });

  it("combines search and status filters and clears an empty result", async () => {
    render(<KnowledgePage />);
    await screen.findByText("Ark Nova");
    fireEvent.change(screen.getByLabelText("搜尋遊戲"), { target: { value: " BRASS " } });
    expect(screen.queryByText("Ark Nova")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /已發布/ }));
    expect(screen.getByText("找不到符合條件的遊戲")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "清除搜尋與篩選" }));
    expect(screen.getByText("Ark Nova")).toBeInTheDocument();
  });

  it("offers direct reading and editorial management instead of disabled PDF upload", async () => {
    render(<KnowledgePage />);
    expect(await screen.findByRole("link", { name: "查找 Brass 規則" })).toHaveAttribute("href", "/knowledge/brass/reader");
    expect(screen.getByRole("link", { name: "管理 Brass 整理稿" })).toHaveAttribute("href", "/knowledge/brass/manage");
    expect(screen.queryByLabelText("PDF 檔案")).not.toBeInTheDocument();
  });

  it("shows a retry action when the games request fails", async () => {
    let attempts = 0;
    vi.mocked(fetch).mockImplementation(async input => {
      const url = String(input);
      if (url.endsWith("/games") && attempts++ === 0) return { ok: false, json: async () => ({ error: "暫時無法連線" }) } as Response;
      return { ok: true, json: async () => url.endsWith("/session") ? { authenticated: false } : { games: url.endsWith("notion-games") ? [] : games } } as Response;
    });
    render(<KnowledgePage />);
    fireEvent.click(await screen.findByRole("button", { name: "重新載入遊戲" }));
    expect(await screen.findByText("Brass")).toBeInTheDocument();
    expect(screen.queryByText("暫時無法連線")).not.toBeInTheDocument();
  });
});
