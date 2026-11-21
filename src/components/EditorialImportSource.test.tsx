import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import EditorialImportSource from "./EditorialImportSource";

afterEach(() => vi.unstubAllGlobals());
it("loads source locations and saves an explicit expansion dependency", async () => {
  const calls: { path: string; body?: string }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (path: string, options: RequestInit) => {
    calls.push({ path, body: options.body as string });
    return { ok: true, json: async () => path.endsWith("/locations") ? { locations: [{ kind: "image", page: 2, block: 3 }] } : { document: options.body ? JSON.parse(options.body as string) : null } };
  }));
  render(<EditorialImportSource base="/imports" password="admin" job={{ id: "exp", filename: "Expansion" }} jobs={[{ id: "base", filename: "Base rules" }]} />);
  fireEvent.click(screen.getByText("文件關聯與來源裁切"));
  expect(await screen.findByText("第 2 頁 · 圖片 3")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("文件類型"), { target: { value: "expansion" } });
  fireEvent.change(screen.getByLabelText("文件版本"), { target: { value: "v2" } });
  expect(screen.getByText("保存文件關聯")).toBeDisabled();
  fireEvent.change(screen.getByLabelText("依據文件"), { target: { value: "base" } });
  fireEvent.click(screen.getByText("保存文件關聯"));
  await waitFor(() => expect(calls.at(-1)?.body).toBe(JSON.stringify({ kind: "expansion", edition: "v2", parent_job_id: "base" })));
  expect(await screen.findByText(/文件：擴充/)).toBeInTheDocument();
});

it("corrects a saved setting with its version and retains edits after a conflict", async () => {
  const requests: Record<string, unknown>[] = [];
  const version = "a".repeat(64);
  vi.stubGlobal("fetch", vi.fn(async (path: string, options: RequestInit) => {
    if (options.body) {
      requests.push(JSON.parse(options.body as string));
      return { ok: false, json: async () => ({ error: "適用設定已變更；請重新讀取" }) };
    }
    return { ok: true, json: async () => path.endsWith("/locations") ? { locations: [] } : { settings_version: version, document: { kind: "base", edition: "1", parent_job_id: "" } } };
  }));
  render(<EditorialImportSource base="/imports" password="admin" job={{ id: "base", filename: "Base" }} jobs={[]} />);
  fireEvent.click(screen.getByText("文件關聯與來源裁切"));
  fireEvent.click(await screen.findByText("更正文件設定"));
  fireEvent.change(screen.getByLabelText("文件版本"), { target: { value: "2" } });
  fireEvent.click(screen.getByText("保存文件關聯"));
  expect(await screen.findByRole("alert")).toHaveTextContent("適用設定已變更");
  expect(requests[0]).toEqual({ kind: "base", edition: "2", parent_job_id: "", expected_settings_version: version });
  expect(screen.getByLabelText("文件版本")).toHaveValue("2");
  expect(screen.getByText(/文件：基本版/)).toHaveTextContent("版本 1");
});
