import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ImportSourceImages from "./ImportSourceImages";

const base = "/api/rules/knowledge/games/game/editorial/imports/" + "b".repeat(32);
const digest = "a".repeat(64);
afterEach(() => vi.unstubAllGlobals());

it("binds original crops and whole pages to the authenticated document", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ digest, locations: [{ kind: "image", page: 2, block: 3 }, { kind: "text", page: 2, block: 4 }] }) }));
  render(<ImportSourceImages base={base} initialPage={2} version="old-snapshot" />);
  const image = await screen.findByRole("img");
  expect(image).toHaveAttribute("src", `${base}/pages/2/image?digest=${digest}`);
  fireEvent.click(screen.getByRole("button", { name: "放大" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "原圖區域 3" }));
  expect(within(dialog).getByRole("img")).toHaveAttribute("src", `${base}/pages/2/blocks/3/image`);
  fireEvent.click(within(dialog).getByRole("button", { name: "來源整頁" }));
  expect(within(dialog).getByRole("img")).toHaveAttribute("src", `${base}/pages/2/image?digest=${digest}`);
  expect(within(dialog).getByText(/閱讀快照/)).toHaveTextContent("old-snapshot");
});

it("shows whole pages without inventing crop positions and rejects invalid pages", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ digest, locations: [] }) }));
  render(<ImportSourceImages base={base} totalPages={4} />);
  expect(await screen.findByRole("img")).toHaveAttribute("src", `${base}/pages/1/image?digest=${digest}`);
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "5" } });
  expect(screen.getByRole("alert")).toHaveTextContent("有效的 PDF");
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

it("fails closed when source identity is unavailable and allows retry", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ digest: "", locations: [] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ digest, locations: [] }) });
  vi.stubGlobal("fetch", fetcher);
  render(<ImportSourceImages base={base} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("原件版本");
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "重新讀取來源" }));
  await waitFor(() => expect(screen.getByRole("img")).toBeInTheDocument());
});
