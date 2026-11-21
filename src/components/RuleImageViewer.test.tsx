import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import RuleImageViewer from "./RuleImageViewer";

const images = [
  { id: "crop", label: "原圖區域", src: "/api/crop", alt: "原書公司稅表", provenance: "原件 abc · PDF 第 20 頁" },
  { id: "whole", label: "來源整頁", src: "/api/whole", alt: "完整稅務頁", provenance: "原件 abc · PDF 第 20 頁整頁" },
];
afterEach(() => { document.body.style.overflow = ""; vi.restoreAllMocks(); });

it("zooms and switches to the original page then restores reader focus", () => {
  render(<RuleImageViewer images={images} caption="稅務" sourceHref="/api/source#page=20" />);
  const trigger = screen.getByRole("button", { name: "放大與核對來源" });
  trigger.focus(); fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog");
  expect(document.body.style.overflow).toBe("hidden");
  const more = within(dialog).getByRole("button", { name: "放大圖片" });
  for (let i = 0; i < 5; i++) fireEvent.click(more);
  expect(more).toBeDisabled();
  expect(within(dialog).getByRole("img")).toHaveStyle({ width: "300%" });
  fireEvent.click(within(dialog).getByRole("button", { name: "來源整頁" }));
  expect(within(dialog).getByRole("img")).toHaveAttribute("src", "/api/whole");
  expect(within(dialog).getByRole("img")).toHaveStyle({ width: "100%" });
  fireEvent.click(within(dialog).getByRole("button", { name: "關閉原圖，返回閱讀" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(document.body.style.overflow).toBe("");
  expect(trigger).toHaveFocus();
});

it("retries a failed image and keeps the page alternative accessible", () => {
  render(<RuleImageViewer images={images} caption="稅務" />);
  fireEvent.click(screen.getByRole("button", { name: "放大與核對來源" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.error(within(dialog).getByRole("img"));
  expect(within(dialog).getByRole("alert")).toHaveTextContent("來源版本");
  fireEvent.click(within(dialog).getByRole("button", { name: "重新載入圖片" }));
  expect(within(dialog).getByRole("img")).toHaveAttribute("src", "/api/crop");
  fireEvent.click(within(dialog).getByRole("button", { name: "來源整頁" }));
  expect(within(dialog).getByRole("img")).toHaveAttribute("alt", "完整稅務頁");
});
