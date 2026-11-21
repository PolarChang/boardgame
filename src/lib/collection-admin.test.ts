import { afterEach, expect, it, vi } from "vitest";
import { verifyCollectionAdmin } from "./collection-admin";
afterEach(() => vi.unstubAllGlobals());
it("verifies the existing password without creating a player", async () => {
  const request=vi.fn().mockResolvedValue(new Response("{}",{status:200}));
  vi.stubGlobal("fetch",request);
  expect(await verifyCollectionAdmin("existing-password")).toBe(true);
  expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({password:"existing-password",names:["__verify__"]});
});
it("does not grant login for an incorrect password", async () => {
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("{}",{status:401})));
  expect(await verifyCollectionAdmin("incorrect")).toBe(false);
});
it("keeps service errors distinct from an incorrect password", async () => {
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("{}",{status:503})));
  await expect(verifyCollectionAdmin("existing-password")).rejects.toThrow("無法驗證管理登入");
});
