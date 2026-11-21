import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import EditorialFlowEditor from "./EditorialFlowEditor";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("creates only a pending flow and keeps the form when saving fails", () => {
  vi.stubGlobal("React", React);
  const onAppend = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
  render(<EditorialFlowEditor text={"# 規則整理稿 v1\n## 規則 R1\n標題：行動\n"} disabled={false} onAppend={onAppend} />);
  fireEvent.click(screen.getByText("建立流程草稿"));
  fireEvent.change(screen.getByLabelText("流程名稱"), {target:{value:"回合"}});
  fireEvent.change(screen.getByLabelText("起點引用規則"), {target:{value:"R1"}});
  fireEvent.change(screen.getByLabelText("結束引用規則"), {target:{value:"R1"}});
  fireEvent.click(screen.getByRole("button", {name:"加入待校對流程"}));
  expect(screen.getByRole("status")).toHaveTextContent("尚未加入");
  expect(screen.getByLabelText("流程名稱")).toHaveValue("回合");
  fireEvent.click(screen.getByRole("button", {name:"加入待校對流程"}));
  expect(screen.getByRole("status")).toHaveTextContent("所有流程段落保持待確認");
  expect(onAppend.mock.calls[1][0].every((b: {kind:string;fields:Record<string,string>}) => b.kind !== "規則" && b.fields.狀態 === "待確認")).toBe(true);
});
