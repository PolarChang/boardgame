import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clubHandler } from "./meet.js";

const token = "a".repeat(64);
const oldAdmin = "b".repeat(64);
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
describe("meeting roles and existing registrations", () => {
  let db: any;
  let put: ReturnType<typeof vi.fn>;
  let call: (action?: string, body?: object, admin?: boolean, cookie?: string) => Promise<any>;
  beforeEach(() => {
    vi.stubEnv("MEETING_ADMIN_BRIDGE_SECRET", "bridge-secret");
    db = { adminHash: hash(oldAdmin), catalog: [], members: { [hash(token)]: { name: "既有玩家", active: true } }, events: [{ id: "existing-event", title: "既有場次", area: "台北", start: "2099-01-02T18:00", end: "2099-01-02T22:00", deadline: "2099-01-01T18:00", rows: [], log: [] }] };
    put = vi.fn(async (_path, data) => { db = JSON.parse(data); });
    const handler = clubHandler("club/v1.json", { get: async () => ({ stream: JSON.stringify(db), blob: { etag: '"existing"' } }), put });
    call = async (action, body = {}, admin = false, cookie = token) => {
      const result: any = { statusCode: 200, headers: {} };
      const res = { setHeader: (k: string,v: string) => { result.headers[k]=v; }, status: (s: number) => { result.statusCode=s; return res; }, json: (value: any) => { result.body=value; return result; } };
      await handler({ method: action ? "POST" : "GET", body: { action,...body }, headers: { host: "meeting.test", cookie: `club=${cookie}`, ...(admin ? { "x-meeting-admin": "bridge-secret" } : {}) } },res);
      return result;
    };
  });
  afterEach(() => vi.unstubAllEnvs());
  it("accepts an existing invitation exclusively as a player", async () => {
    const result = await call("login",{ key: token });
    expect(result.statusCode).toBe(200);
    expect(result.body.admin).toBe(false);
    expect(result.body.members).toBeUndefined();
    expect(result.headers["Set-Cookie"]).toContain(`club=${token}`);
  });
  it("saves the nine-person roster in a draft with details pending", async () => {
    const roster = Array.from({ length: 7 }, (_, index) => ({
      name: `玩家 ${index}`,
      notionPlayerId: `11111111-2222-4333-8444-55555555555${index}`,
      ...(index < 2 ? { companions: [`同行 ${index}`] } : {}),
    }));
    const created = await call("create", {
      title: "九人場次", start: "2027-01-09T13:00", draft: true, capacity: 9, roster,
    }, true);
    expect(created.statusCode).toBe(200);
    expect(created.body.events[0]).toMatchObject({ capacity: 9, count: 9, end: "", area: "", deadline: "" });
    expect((await call()).body.events).toHaveLength(1);
    const blocked = await call("edit", {
      event: created.body.selected, title: "九人場次", start: "2027-01-09T13:00", draft: true, capacity: 8,
    }, true);
    expect(blocked.statusCode).toBe(400);
  });
  it("can bind a new invitation to an existing Notion player without duplicating the identity", async () => {
    const notionPlayerId = "11111111-2222-4333-8444-555555555555";
    const result = await call("invite", { name: "熟客", notionPlayerId }, true);
    expect(result.statusCode).toBe(200);
    const invite = result.body.invite;
    expect((await call(undefined, {}, false, invite)).body.profile.notionPlayerId).toBe(notionPlayerId);
    expect((await call("invite", { name: "熟客", notionPlayerId }, true)).statusCode).toBe(400);
  });
  it("revokes a deleted invitation and restores its registrations under a new link", async () => {
    await call("join", { event: "existing-event", pref: ["中"] });
    const uid = hash(token);
    expect((await call("deleteInvite", { uid })).statusCode).toBe(403);
    expect((await call("deleteInvite", { uid }, true)).statusCode).toBe(200);
    expect((await call()).statusCode).toBe(401);
    expect((await call("login", { key: token })).statusCode).toBe(401);
    expect((await call("member", { uid, active: true }, true)).statusCode).toBe(400);
    expect(db.events[0].rows).toHaveLength(1);
    const restored = await call("restoreInvite", { uid }, true);
    expect(restored.body.invite).not.toBe(token);
    expect((await call()).statusCode).toBe(401);
    expect((await call(undefined, {}, false, restored.body.invite)).body.events[0].me.status).toBe("正取");
  });
  it("keeps a requested cancellation seated until the organizer approves it", async () => {
    await call("join", { event: "existing-event", pref: ["中"] });
    const row = db.events[0].rows[0];
    const requested = await call("requestCancellation", { event: "existing-event", row: "ignored" });
    expect(requested.body.events[0]).toMatchObject({
      count: 1, me: { status: "正取", cancellationRequested: true },
    });
    expect((await call("cancel", { event: "existing-event", row: row.id })).statusCode).toBe(403);
    await call("cancel", { event: "existing-event", row: row.id }, true);
    expect((await call()).body.events[0]).toMatchObject({
      count: 0, me: { status: "取消", cancellationRequested: false },
    });
  });
  it("admits the organizer and five companions in a single registration", async () => {
    const event = "existing-event";
    const result = await call("join", {
      event, companions: ["甲", "乙", "丙", "丁", "戊"], pref: ["中"],
    });
    expect(result.body.events[0]).toMatchObject({ count: 6, waiting: 0, me: { status: "正取" } });
    expect(new Set(db.events[0].rows.map((row: { groupId: string }) => row.groupId)).size).toBe(1);
    expect((await call("join", { event, companions: ["己"], pref: ["中"] })).statusCode).toBe(400);
    expect(db.events[0].rows).toHaveLength(6);
  });

  it("requires approval of companion changes and preserves the other seats", async () => {
    const event = "existing-event";
    await call("join", { event, companions: ["甲", "乙"], pref: ["中"] });
    const [, first, second] = db.events[0].rows;
    const stranger = await call("invite", { name: "他團玩家" }, true);
    expect((await call("requestCompanionChange", {
      event, row: first.id, kind: "remove",
    }, false, stranger.body.invite)).statusCode).toBe(403);
    expect((await call("requestCompanionChange", {
      event, row: first.id, kind: "replace", name: "丙",
    })).statusCode).toBe(200);
    expect((await call()).body.events[0]).toMatchObject({ count: 3, me: { companions: [
      { name: "甲", changeRequest: { kind: "replace", name: "丙" } }, { name: "乙" },
    ] } });
    expect((await call("resolveCompanionChange", { event, row: first.id, decision: "approve" })).statusCode).toBe(403);
    await call("resolveCompanionChange", { event, row: first.id, decision: "approve" }, true);
    await call("requestCompanionChange", { event, row: second.id, kind: "remove" });
    expect((await call()).body.events[0].count).toBe(3);
    await call("resolveCompanionChange", { event, row: second.id, decision: "approve" }, true);
    expect((await call()).body.events[0]).toMatchObject({ count: 2, me: {
      companions: [{ name: "丙" }], removedCompanions: ["乙"],
    } });
  });

  it("waitlists a party together, keeps later applicants behind it, and promotes only when it fits", async () => {
    const event = "existing-event";
    for (let i = 0; i < 5; i++) {
      expect((await call("guest", { event, name: `Guest ${i}`, pref: ["中"] }, true)).statusCode).toBe(200);
    }
    expect((await call("join", { event, companions: ["同行一"], pref: ["中"] })).body.events[0]).toMatchObject({
      count: 5, waiting: 2, me: { status: "候補", waitPosition: 1, companions: [{ name: "同行一" }] },
    });
    const invite = await call("invite", { name: "下一位" }, true);
    expect((await call("join", { event, pref: ["中"] }, false, invite.body.invite)).body.events[0].me).toMatchObject({
      status: "候補", waitPosition: 2,
    });
    const leader = db.events[0].rows.find((row: { groupLeader?: boolean }) => row.groupLeader);
    expect((await call("promote", { event, row: leader.id }, true)).statusCode).toBe(400);
    await call("cancel", { event, row: db.events[0].rows[0].id }, true);
    expect((await call("promote", { event, row: leader.id }, true)).body.events[0]).toMatchObject({ count: 6, waiting: 1 });
    await call("requestCancellation", { event });
    expect((await call()).body.events[0].count).toBe(6);
    expect((await call("cancel", { event, row: leader.id }, true)).body.events[0]).toMatchObject({ count: 4, waiting: 1 });
  });

  it.each([["既有玩家"], ["甲", "甲"], ["一","二","三","四","五","六"], [" "]])(
    "rejects invalid companion names %j before changing seats",
    async (...names) => {
      const result = await call("join", { event: "existing-event", companions: names, pref: ["中"] });
      expect(result.statusCode).toBe(400);
      expect(put).not.toHaveBeenCalled();
    },
  );
  it("persists a player's signup under the existing member identity", async () => {
    expect((await call("join",{ event: "existing-event", pref: ["中"] })).statusCode).toBe(200);
    expect(db.events[0].rows[0].uid).toBe(hash(token));
    expect((await call()).body.events[0].me.status).toBe("正取");
    expect((await call("join",{ event: "existing-event", pref: ["中"] })).statusCode).toBe(400);
    expect(db.events[0].rows).toHaveLength(1);
  });
  it("preserves stable player identity and registration when an invitation is reissued", async () => {
    await call("join", { event: "existing-event", pref: ["中"] });
    const initial = await call("reissue", { uid: hash(token) }, true);
    const firstInvite = initial.body.invite;
    const playerId = db.members[hash(firstInvite)].playerId;
    expect(playerId).toEqual(expect.any(String));
    const reissued = await call("reissue", { uid: hash(firstInvite) }, true);
    const nextInvite = reissued.body.invite;
    expect(db.members[hash(nextInvite)].playerId).toBe(playerId);
    expect((await call(undefined, {}, false, nextInvite)).body.events[0].me.status).toBe("正取");
    expect((await call(undefined, {}, false, firstInvite)).statusCode).toBe(401);
  });
  it.each(["create","edit","invite","reissue","member","catalog","restore","guest","cancel","promote","publish","account","stop","finish","backup"])("rejects player management action %s without storage writes", async action => {
    const before=JSON.stringify(db);
    expect((await call(action,{ event: "existing-event" })).statusCode).toBe(403);
    expect(put).not.toHaveBeenCalled();
    expect(JSON.stringify(db)).toBe(before);
  });
  it("rejects old organizer-key login and cookie authentication", async () => {
    expect((await call("login",{ key: oldAdmin })).statusCode).toBe(401);
    expect((await call(undefined,{},false,oldAdmin)).statusCode).toBe(401);
  });
  it.each(["rotate","recover"])("disables %s even for administrators", async action => {
    expect((await call(action,{},true)).statusCode).toBe(410);
    expect(put).not.toHaveBeenCalled();
  });
  it("allows verified Boardgame administrators without a legacy key", async () => {
    const result=await call("create",{ title:"測試場次",area:"台北",start:"2099-02-02T18:00",end:"2099-02-02T22:00",deadline:"2099-02-01T18:00" },true,"");
    expect(result.statusCode).toBe(200);
    expect(result.body.admin).toBe(true);
    expect(db.events).toHaveLength(2);
    expect((await call(undefined,{},true,"")).body.events[0].title).toBe("測試場次");
  });
});
