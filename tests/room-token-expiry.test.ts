/**
 * Client-side room-token expiry.
 *
 * Regression cover for a browser-only failure: the expiry reader used `Buffer`,
 * which browsers do not have, so it returned null in every real client. The
 * proactive refresh never armed and an idle tab reconnected with a dead token
 * forever. Node test runs have `Buffer`, which is exactly why this was never
 * caught — so one case here removes it.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { isRoomTokenExpired, parseRoomTokenExpiry } from "@/lib/room-token-expiry";
import { parseRoomTokenExpiry as parseViaServerModule } from "@/lib/socket-token";
import { mintRoomToken } from "@/socket-server/src/server";

const SECRET = "t".repeat(32);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("room token expiry (client-safe)", () => {
  it("reads the expiry claim from a real relay-minted token", () => {
    const before = Math.floor(Date.now() / 1000);
    const exp = parseRoomTokenExpiry(mintRoomToken("session-1", "teacher", "teacher-1", SECRET, 300));
    expect(exp).not.toBeNull();
    expect(exp!).toBeGreaterThanOrEqual(before + 299);
    expect(exp!).toBeLessThanOrEqual(before + 301);
  });

  it("still decodes when Buffer does not exist, as in every browser", () => {
    const token = mintRoomToken("session-1", "student", "student-1", SECRET, 300);
    vi.stubGlobal("Buffer", undefined);
    expect(parseRoomTokenExpiry(token)).toBeTypeOf("number");
    expect(isRoomTokenExpired(token)).toBe(false);
  });

  it("reports an expired token as expired and a live one as live", () => {
    expect(isRoomTokenExpired(mintRoomToken("s", "teacher", "t", SECRET, -60))).toBe(true);
    expect(isRoomTokenExpired(mintRoomToken("s", "teacher", "t", SECRET, 300))).toBe(false);
  });

  it("treats an unreadable token as not expired so it cannot drive a refresh loop", () => {
    for (const token of ["", "garbage", "a.b.c", "a.!!!.c", "a..c"]) {
      expect(parseRoomTokenExpiry(token)).toBeNull();
      expect(isRoomTokenExpired(token)).toBe(false);
    }
  });

  it("decodes multi-byte UTF-8 in the payload", () => {
    const token = mintRoomToken("session-ü", "student", "élève-名前", SECRET, 300);
    expect(parseRoomTokenExpiry(token)).toBeTypeOf("number");
  });

  it("keeps the server module's export pointing at the same implementation", () => {
    const token = mintRoomToken("session-1", "teacher", "teacher-1", SECRET, 300);
    expect(parseViaServerModule(token)).toBe(parseRoomTokenExpiry(token));
  });
});
