import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import EditorialLogin from "./EditorialLogin";

afterEach(() => vi.unstubAllGlobals());

it("keeps access state on logout transport failure and allows a successful retry", async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ authenticated: true }) })
    .mockRejectedValueOnce(new TypeError("Network error"))
    .mockResolvedValueOnce({ ok: true });
  vi.stubGlobal("fetch", fetcher);
  const onLogin = vi.fn();
  render(<EditorialLogin gameId="game" onLogin={onLogin} />);
  fireEvent.click(await screen.findByRole("button", { name: "登出管理存取" }));
  onLogin.mockClear();
  expect(await screen.findByRole("alert")).toHaveTextContent("登出失敗，請重試");
  expect(onLogin).not.toHaveBeenCalledWith(false);
  const retry = screen.getByRole("button", { name: "登出管理存取" });
  expect(retry).toBeEnabled();
  fireEvent.click(retry);
  await waitFor(() => expect(onLogin).toHaveBeenLastCalledWith(false));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByLabelText("管理登入密碼")).toBeInTheDocument();
});

it("clears the previous game's login display and fails closed on session lookup failure", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ authenticated: true }) })
    .mockRejectedValueOnce(new TypeError("offline")));
  const onLogin = vi.fn();
  const view = render(<EditorialLogin gameId="first" onLogin={onLogin} />);
  await screen.findByRole("button", { name: "登出管理存取" });
  view.rerender(<EditorialLogin gameId="second" onLogin={onLogin} />);
  expect(screen.queryByRole("button", { name: "登出管理存取" })).not.toBeInTheDocument();
  expect(await screen.findByRole("alert")).toHaveTextContent("無法確認登入狀態");
  expect(onLogin).toHaveBeenLastCalledWith(false);
});
