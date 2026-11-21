import { describe, expect, it, vi } from "vitest";
import { createSession, sessionCookie, sessionKey } from "./editorial-session";

describe("private editorial sessions", () => {
  it("requires an opaque cookie and expires after two hours", () => {
    vi.useFakeTimers();
    try {
      const token = createSession("private-key");
      expect(token).not.toContain("private-key");
      const request = new Request("http://localhost/api/rules", { headers: { cookie: `${sessionCookie}=${token}` } });
      expect(sessionKey(new Request("http://localhost/api/rules"))).toBe("");
      expect(sessionKey(request)).toBe("private-key");
      vi.advanceTimersByTime(7200001);
      expect(sessionKey(request)).toBe("");
    } finally { vi.useRealTimers(); }
  });
});
