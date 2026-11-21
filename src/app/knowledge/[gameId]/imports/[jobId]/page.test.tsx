import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import RulesPage from "./page";
import QuestionsPage from "./questions/page";
import SourcePage from "./source/page";

vi.mock("next/navigation", () => ({ useParams: () => ({ gameId: "game", jobId: "job" }) }));
vi.mock("@/components/EditorialLogin", () => ({ default: ({ onLogin }: { onLogin: (value: boolean) => void }) => <button onClick={() => onLogin(true)}>登入測試</button> }));
vi.mock("@/components/EditorialDraftPreview", () => ({ default: () => null }));
vi.mock("@/components/ImportQuality", () => ({ default: () => null }));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const savedContext = { revision: 0, confirmed_context: { role: "", players: "", stage: "", situation: "" } };

it("pins the displayed settings version in a question and labels the saved answer", async () => {
  const version = "a".repeat(64), settingsVersion = "b".repeat(64);
  const sent: Record<string, unknown>[] = [];
  vi.stubGlobal("fetch", vi.fn(async (path: string, options: RequestInit) => {
    if (path.includes("/context?")) return { ok: true, json: async () => savedContext };
    if (path.includes("/answers")) return { ok: true, json: async () => ({ jobs: [] }) };
    if (path.includes("/questions")) return { ok: true, json: async () => ({ jobs: [] }) };
    if (path.endsWith("/document")) return { ok: true, json: async () => ({ settings_version: settingsVersion, document: { kind: "base", edition: "第二版" } }) };
    if (path.endsWith("/ask")) {
      sent.push(JSON.parse(options.body as string));
      return { ok: true, json: async () => ({ answer: "有來源的答案", citations: [], kind: "ai", settings_version: settingsVersion, confirmed_context: { players: "2" }, source_settings: { kind: "base", edition: "第二版" } }) };
    }
    return { ok: true, json: async () => ({ version, document: { blocks: [] }, completed_pages: 1, total: 1 }) };
  }));
  render(<QuestionsPage />);
  fireEvent.click(screen.getByText("登入測試"));
  fireEvent.click(await screen.findByText("情境與問答設定"));
  expect(await screen.findByText(/目前適用：基本版 · 第二版/)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText("人數")).not.toBeDisabled());
  fireEvent.change(screen.getByLabelText("人數"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("想詢問的規則"), { target: { value: "如何準備？" } });
  fireEvent.click(screen.getByText("試問此版本"));
  await waitFor(() => expect(sent).toEqual([{ question: "如何準備？", version, settings_version: settingsVersion, confirmed_context: { players: "2" } }]));
  expect(await screen.findByText(/本回答情境：人數：2。本回答適用：基本版 · 第二版/)).toBeInTheDocument();
});

it("restores a saved answer using its original snapshot instead of the current document", async () => {
  const old = "c".repeat(64), current = "a".repeat(64);
  const fetcher = vi.fn(async (path: string) => {
    if (path.includes("/context?")) return { ok: true, json: async () => savedContext };
    if (path.endsWith("/document")) return { ok: true, json: async () => ({ settings_version: "new", document: { kind: "base", edition: "新版" } }) };
    if (path.includes("/answers")) return { ok: true, json: async () => ({ jobs: [] }) };
    if (path.includes("/questions")) return { ok: true, json: async () => ({ jobs: [{ id: "saved", status: "completed", created_at: 1, question: { question: "原來的問題", version: old, settings_version: "old", confirmed_context: {} }, result: { answer: "保存的答案", citations: ["RULE-1"], kind: "ai", settings_version: "old", source_settings: { kind: "base", edition: "舊版" } }, error: "" }] }) };
    const pinned = path.includes(`version=${old}`);
    return { ok: true, json: async () => ({ version: pinned ? old : current, completed_pages: 1, total: 1, document: { blocks: [{ kind: "規則", id: "RULE-1", fields: { 標題: "費用", 原文: pinned ? "Pay 2 resources." : "Pay 9 resources.", PDF頁碼: pinned ? "2" : "9" } }] } }) };
  });
  vi.stubGlobal("fetch", fetcher);
  render(<QuestionsPage />);
  fireEvent.click(screen.getByText("登入測試"));
  fireEvent.click(await screen.findByText("問答紀錄與回饋"));
  fireEvent.click(await screen.findByText("查看保存的回答"));
  expect(await screen.findByText("保存的答案")).toBeInTheDocument();
  expect(screen.getByText(/核對引用 RULE-1 · PDF 第 2 頁/)).toBeInTheDocument();
  expect(screen.queryByText(/核對引用 RULE-1 · PDF 第 9 頁/)).not.toBeInTheDocument();
  expect(screen.getByText(/與目前閱讀版本不同/)).toBeInTheDocument();
  expect(fetcher.mock.calls.some(([path]) => path.endsWith("/ask"))).toBe(false);
});

it("keeps the candidate background submission behind its explicit feature flag", async () => {
  vi.stubEnv("NEXT_PUBLIC_LOCAL_BACKGROUND_QA", "true");
  vi.stubGlobal("fetch", vi.fn(async (path: string) => ({ ok: true, json: async () => path.includes("/context?") ? savedContext : (path.includes("/questions") || path.includes("/answers")) ? { jobs: [] } : path.endsWith("/document") ? { settings_version: "b".repeat(64), document: null } : { version: "a".repeat(64), document: { blocks: [] }, completed_pages: 1, total: 1 } })));
  render(<QuestionsPage />);
  fireEvent.click(screen.getByText("登入測試"));
  const submit = await screen.findByText("提交背景問答（試用）");
  expect(submit).toBeDisabled();
  await waitFor(() => expect(screen.getByLabelText("人數")).not.toBeDisabled());
  fireEvent.change(screen.getByLabelText("想詢問的規則"), { target: { value: "如何準備？" } });
  expect(submit).not.toBeDisabled();
});

it.each([
  [{ kind: "partial" }, "部分回答"],
  [{ kind: "ai", status: "complete", coverage_gaps: ["尚未引用首輪例外"] }, "部分回答"],
  [{ kind: "ai", status: "complete" }, "完整回答"],
  [{ kind: "partial", status: "needs_context" }, "需要補充情境"],
])("labels reopened answers without losing original citations: %j", async (shape, label) => {
  const version = "a".repeat(64);
  vi.stubGlobal("fetch", vi.fn(async (path: string) => {
    if (path.includes("/context?")) return { ok: true, json: async () => savedContext };
    if (path.endsWith("/document")) return { ok: true, json: async () => ({ settings_version: "b".repeat(64), document: null }) };
    if (path.includes("/answers")) return { ok: true, json: async () => ({ jobs: [{ id: "saved", status: "completed", created_at: 1, question: { question: "有哪些階段？", version }, result: { answer: "保存的回答", citations: ["R1"], ...shape }, error: "" }] }) };
    if (path.includes("/questions")) return { ok: true, json: async () => ({ jobs: [] }) };
    return { ok: true, json: async () => ({ version, completed_pages: 1, total: 1, document: { blocks: [{ kind: "規則", id: "R1", fields: { 標題: "首輪例外", 原文: "Skip this phase in the first round.", PDF頁碼: "11" } }] } }) };
  }));
  render(<QuestionsPage />);
  fireEvent.click(screen.getByText("登入測試"));
  fireEvent.click(await screen.findByText("問答紀錄與回饋"));
  fireEvent.click(await screen.findByText("查看保存的回答"));
  expect(await screen.findByText(label)).toBeInTheDocument();
  expect(screen.getByText(/核對引用 R1 · PDF 第 11 頁/)).toBeInTheDocument();
  fireEvent.click(screen.getByText(/核對引用 R1/));
  expect(screen.getByRole("link", { name: "看原文 · 第 11 頁" })).toHaveAttribute("href", `/knowledge/game/imports/job/source?page=11&version=${version}`);
  if ("coverage_gaps" in shape) expect(screen.getByText("尚未引用首輪例外")).toBeInTheDocument();
  if (label === "完整回答") expect(screen.queryByText("部分回答")).not.toBeInTheDocument();
});

it("links to separate tasks without loading their data from the search page", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: "a".repeat(64), document: { blocks: [] }, total: 4 }) });
  vi.stubGlobal("fetch", fetcher);
  render(<RulesPage />);
  fireEvent.click(screen.getByText("登入測試"));
  expect(await screen.findByRole("link", { name: "看原書" })).toHaveAttribute("href", "/knowledge/game/imports/job/source");
  expect(screen.getByRole("link", { name: "問規則" })).toHaveAttribute("href", "/knowledge/game/imports/job/questions");
  expect(screen.queryByLabelText("想詢問的規則")).not.toBeInTheDocument();
  expect(fetcher.mock.calls.map(([path]) => path)).toEqual([expect.stringMatching(/\/draft$/)]);
});

it("opens the cited page in the original rulebook without showing the question form", async () => {
  const version = "a".repeat(64);
  const digest = "b".repeat(64);
  window.history.replaceState(null, "", `?page=3&version=${version}`);
  vi.stubGlobal("fetch", vi.fn(async (path: string) => ({
    ok: true, json: async () => path.endsWith("/locations") ? { digest, locations: [] } : { version, document: { blocks: [] }, total: 4 },
  })));
  try {
    render(<SourcePage />);
    fireEvent.click(screen.getByText("登入測試"));
    expect(await screen.findByRole("img")).toHaveAttribute("src", expect.stringContaining(`/pages/3/image?digest=${digest}`));
    expect(screen.queryByLabelText("想詢問的規則")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "下一頁" }));
    expect(screen.getByRole("img")).toHaveAttribute("src", expect.stringContaining("/pages/4/image"));
    expect(screen.getByRole("button", { name: "下一頁" })).toBeDisabled();
  } finally {
    window.history.replaceState(null, "", window.location.pathname);
  }
});
