import { expect, it, vi } from "vitest";
import { flushNotionMeeting, queueNotionEvent } from "./notion-sync.js";

it("keeps a newer registration queued if its status changes during a Notion write", async () => {
  const event = { id: "event", title: "Test", rows: [{ id: "row", uid: "uid", status: "候補" }] };
  const db = { events: [event], members: { uid: { notionPlayerId: "player-page" } } };
  queueNotionEvent(db, event, undefined);
  let persisted = structuredClone(db);
  const load = async () => ({ db: structuredClone(persisted) });
  const save = async ({ db: updated }: Awaited<ReturnType<typeof load>>) => {
    persisted = structuredClone(updated);
    return true;
  };
  const registration = vi.fn(async () => {
    const previous = structuredClone(persisted.events[0]);
    persisted.events[0].rows[0].status = "正取";
    queueNotionEvent(persisted, persisted.events[0], previous);
  });
  const records = {
    gathering: vi.fn(async () => "gathering-page"),
    findGathering: vi.fn(async () => ({ id: "gathering-page" })),
    registration,
  };
  expect(await flushNotionMeeting({ load, save, records })).toBe("progress");
  expect(registration).toHaveBeenCalledWith(event.rows[0], "gathering-page", "player-page");
  registration.mockResolvedValueOnce(undefined);
  expect(await flushNotionMeeting({ load, save, records })).toBe(true);
  expect(registration).toHaveBeenLastCalledWith(
    { id: "row", uid: "uid", status: "正取" }, "gathering-page", "player-page",
  );
});
