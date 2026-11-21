import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import EditorialSources from "./EditorialSources";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("opens a selected local PDF at the requested page without sending it", () => {
  vi.stubGlobal("React", React);
  const create = vi.fn(() => "blob:local-test"), revoke = vi.fn(), fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("URL", {createObjectURL:create,revokeObjectURL:revoke});
  const view = render(<EditorialSources document={{blocks:[]}} block={{kind:"規則",id:"R-1",fields:{PDF頁碼:"18–20"}}} />);
  fireEvent.change(screen.getByLabelText("選取本機 PDF 對照"), {target:{files:[new File(["%PDF-1.7"], "rules.pdf", {type:"application/pdf"})]}});
  expect(screen.getByRole("link", {name:/開啟第 18 頁/})).toHaveAttribute("href", "blob:local-test#page=18");
  expect(fetch).not.toHaveBeenCalled();
  view.unmount(); expect(revoke).toHaveBeenCalledWith("blob:local-test");
});
