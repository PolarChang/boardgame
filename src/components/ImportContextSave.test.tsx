import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ImportContextSave from "./ImportContextSave";
const empty = { role: "", players: "", stage: "", situation: "" };
const reply = (data: object, ok = true) => ({ ok, json: async () => data });
afterEach(() => vi.unstubAllGlobals());

it("loads saved context and preserves newer edits while a save is in flight", async () => {
  let finish!: (value: unknown) => void;
  const fetcher = vi.fn().mockResolvedValueOnce(reply({ revision: 2, confirmed_context: empty }))
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  vi.stubGlobal("fetch", fetcher);
  const onLoaded = vi.fn(), onReady = vi.fn();
  const props = { base: "/private", version: "v1", context: empty, onLoaded, onReady };
  const view = render(<ImportContextSave {...props} />);
  await waitFor(() => expect(onReady).toHaveBeenLastCalledWith(true));
  expect(onLoaded).toHaveBeenCalledWith(empty);
  view.rerender(<ImportContextSave {...props} context={{ ...empty, players: "2" }} />);
  fireEvent.click(screen.getByRole("button", { name: "保存情境" }));
  view.rerender(<ImportContextSave {...props} context={{ ...empty, players: "3" }} />);
  finish(reply({ revision: 3 }));
  await screen.findByText("情境有未保存變更；離頁前請保存。");
  expect(onLoaded).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ expected_revision: 2, settings_version: "v1", confirmed_context: { players: "2" } });
});

it("does not restore a late response from another version", async () => {
  let finish!: (value: unknown) => void;
  vi.stubGlobal("fetch", vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce(reply({ revision: 0, confirmed_context: empty })));
  const onLoaded = vi.fn(), onReady = vi.fn();
  const props = { base: "/private", version: "v1", context: empty, onLoaded, onReady };
  const view = render(<ImportContextSave {...props} />);
  view.rerender(<ImportContextSave {...props} version="v2" />);
  await waitFor(() => expect(onLoaded).toHaveBeenCalledOnce());
  finish(reply({ revision: 5, confirmed_context: { ...empty, role: "old" } }));
  await waitFor(() => expect(onLoaded).toHaveBeenLastCalledWith(empty));
  expect(onLoaded).toHaveBeenCalledTimes(1);
});

it("keeps failed loads unavailable and displays conflicts without overwriting inputs", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(reply({ detail: "讀取失敗" }, false))
    .mockResolvedValueOnce(reply({ revision: 1, confirmed_context: empty }))
    .mockResolvedValueOnce(reply({ detail: "情境已由另一頁更新" }, false));
  vi.stubGlobal("fetch", fetcher);
  const onLoaded = vi.fn(), onReady = vi.fn();
  const props = { base: "/private", version: "v1", context: empty, onLoaded, onReady };
  const view = render(<ImportContextSave {...props} />);
  await screen.findByText("讀取失敗");
  expect(onReady).not.toHaveBeenCalledWith(true);
  expect(screen.getByRole("button", { name: "保存情境" })).toBeDisabled();
  fireEvent.click(screen.getByText("重新讀取已保存情境（取代欄位內容）"));
  await waitFor(() => expect(onReady).toHaveBeenLastCalledWith(true));
  view.rerender(<ImportContextSave {...props} context={{ ...empty, role: "工人" }} />);
  fireEvent.click(screen.getByRole("button", { name: "保存情境" }));
  await screen.findByText("情境已由另一頁更新");
  expect(onLoaded).toHaveBeenCalledTimes(1);
});
