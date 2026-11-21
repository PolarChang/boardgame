import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import KnowledgeTemplatePage from "./page";

vi.mock("next/navigation", () => ({ useParams: () => ({ gameId: "bgg-1" }) }));

const rules = [
  { id: "setup-1", category: "setup", type: "rule", title: "Prepare the board", rule_text: "Place the board in the center.", simplified_text: null, confidence: "explicit", verification_status: "verified", source: { page: 3, section: "Setup" } },
  { id: "score-1", category: "scoring", type: "rule", title: "Victory points", rule_text: "Gain victory points at the end of the round.", simplified_text: null, confidence: "explicit", verification_status: "verified", source: { page: 20, section: "Scoring" } },
];

beforeEach(() => vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rules }) })));
afterEach(() => vi.unstubAllGlobals());

it("groups rules into approachable top-level sections", async () => {
  render(<KnowledgeTemplatePage />);
  expect(await screen.findByText("Prepare the board")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /開始遊戲/ })).toHaveTextContent("1");
  fireEvent.click(screen.getByRole("button", { name: /計分與結束/ }));
  expect(screen.getByText("Victory points")).toBeInTheDocument();
});

it("finds category rules from a natural-language question", async () => {
  render(<KnowledgeTemplatePage />);
  await screen.findByText("Prepare the board");
  fireEvent.click(screen.getByRole("button", { name: "怎麼得分？" }));
  await waitFor(() => expect(screen.getByText("Victory points")).toBeInTheDocument());
  expect(screen.queryByText("Prepare the board")).not.toBeInTheDocument();
});
