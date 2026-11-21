import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EditorialVisualImport from "./EditorialVisualImport";

afterEach(() => vi.unstubAllGlobals());
describe("visual import preserves concurrent manuscript edits", () => {
  it("appends through the latest callback after upload rather than replacing newer text", async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(done => { resolve = done; })));
    const original = vi.fn(() => true), latest = vi.fn(() => true);
    const view = render(<EditorialVisualImport gameId="game" password="admin" text="old" onAppend={original} />);
    fireEvent.click(screen.getByText("加入原書圖示／元件圖片"));
    fireEvent.change(screen.getByLabelText("來源檔案"), { target: { files: [new File(["pdf"], "source.pdf", { type: "application/pdf" })] } });
    fireEvent.change(screen.getByLabelText("稿件來源編號"), { target: { value: "S1" } });
    fireEvent.click(screen.getByRole("button", { name: "上傳並加入待校對稿" }));
    view.rerender(<EditorialVisualImport gameId="game" password="admin" text="newly edited" onAppend={latest} />);
    await act(async () => resolve(new Response(JSON.stringify({ block: { id: "V1", kind: "圖片", fields: {} } }))));
    await waitFor(() => expect(latest).toHaveBeenCalledOnce());
    expect(original).not.toHaveBeenCalled();
  });
  it("keeps a processed image available when saving the manuscript is blocked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ block: { id: "V1", kind: "圖片", fields: {} } }))));
    const append = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    render(<EditorialVisualImport gameId="game" password="admin" text="draft" onAppend={append} />);
    fireEvent.click(screen.getByText("加入原書圖示／元件圖片"));
    fireEvent.change(screen.getByLabelText("來源檔案"), { target: { files: [new File(["pdf"], "source.pdf")] } });
    fireEvent.change(screen.getByLabelText("稿件來源編號"), { target: { value: "S1" } });
    fireEvent.click(screen.getByRole("button", { name: "上傳並加入待校對稿" }));
    fireEvent.click(await screen.findByRole("button", { name: "將圖片加入目前草稿" }));
    expect(append).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
