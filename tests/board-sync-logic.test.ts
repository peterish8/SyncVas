/** Pure board-sync decisions: token renewal, version commit, apply rules, writer reconcile. */

import { describe, expect, it } from "vitest";

import {
  HANDSHAKE_REFRESH_COOLDOWN_MS,
  MIN_TOKEN_REFRESH_DELAY_MS,
  isTokenRefreshDue,
  mayRefreshAfterHandshakeFailure,
  nextVersionAfterAck,
  reconcileTeacherScene,
  shouldApplyBoardVersion,
  shouldRetryPublishImmediately,
  tokenRefreshDelayMs,
} from "@/lib/board-sync-logic";
import { BOARD_UPDATE_MIN_MS, BOARD_UPDATE_PER_MINUTE, ROOM_TOKEN_TTL_SECONDS } from "@/shared/constants/limits";

describe("token renewal schedule", () => {
  it("renews a minute before the TTL, measured from receipt", () => {
    const receivedAt = 1_000_000;
    expect(tokenRefreshDelayMs(receivedAt, receivedAt)).toBe((ROOM_TOKEN_TTL_SECONDS - 60) * 1000);
  });

  it("is unaffected by how far the device clock is from the server's", () => {
    // A clock ten minutes fast used to schedule a zero delay against the token's exp.
    const fastClockNow = Date.UTC(2030, 0, 1);
    expect(tokenRefreshDelayMs(fastClockNow, fastClockNow)).toBe((ROOM_TOKEN_TTL_SECONDS - 60) * 1000);
  });

  it("never schedules below the floor, so a stale receipt cannot drive a mint loop", () => {
    const receivedAt = 0;
    const muchLater = 60 * 60 * 1000;
    expect(tokenRefreshDelayMs(receivedAt, muchLater)).toBe(MIN_TOKEN_REFRESH_DELAY_MS);
  });

  it("reports renewal due only inside the window", () => {
    const receivedAt = 5_000;
    const dueAt = receivedAt + (ROOM_TOKEN_TTL_SECONDS - 60) * 1000;
    expect(isTokenRefreshDue(receivedAt, dueAt - 1)).toBe(false);
    expect(isTokenRefreshDue(receivedAt, dueAt)).toBe(true);
  });

  it("throttles handshake-triggered mints on elapsed time", () => {
    expect(mayRefreshAfterHandshakeFailure(null, 10)).toBe(true);
    expect(mayRefreshAfterHandshakeFailure(1_000, 1_000 + HANDSHAKE_REFRESH_COOLDOWN_MS - 1)).toBe(false);
    expect(mayRefreshAfterHandshakeFailure(1_000, 1_000 + HANDSHAKE_REFRESH_COOLDOWN_MS)).toBe(true);
  });
});

describe("board version rules", () => {
  it("applies any strictly newer version, including a skip", () => {
    expect(shouldApplyBoardVersion(9, 5)).toBe(true);
    expect(shouldApplyBoardVersion(6, 5)).toBe(true);
  });

  it("ignores equal and older versions, except the empty opening board", () => {
    expect(shouldApplyBoardVersion(5, 5)).toBe(false);
    expect(shouldApplyBoardVersion(4, 5)).toBe(false);
    expect(shouldApplyBoardVersion(0, 0)).toBe(true);
  });

  it("commits a version only when the relay accepts it", () => {
    expect(nextVersionAfterAck(4, { ok: true, boardVersion: 5 })).toBe(5);
    expect(nextVersionAfterAck(4, { ok: false, code: "RATE_LIMITED" })).toBe(4);
    expect(nextVersionAfterAck(4, { ok: false, code: "ACK_TIMEOUT" })).toBe(4);
  });

  it("adopts the relay's version from a stale rejection and never moves backwards", () => {
    expect(nextVersionAfterAck(2, { ok: false, code: "STALE_BOARD_VERSION", boardVersion: 11 })).toBe(11);
    expect(nextVersionAfterAck(12, { ok: true, boardVersion: 7 })).toBe(12);
  });

  it("retries a stale rejection at once and anything else after a pause", () => {
    expect(shouldRetryPublishImmediately({ ok: false, code: "STALE_BOARD_VERSION", boardVersion: 3 })).toBe(true);
    expect(shouldRetryPublishImmediately({ ok: false, code: "RATE_LIMITED" })).toBe(false);
    expect(shouldRetryPublishImmediately({ ok: true, boardVersion: 3 })).toBe(false);
  });

  it("keeps the teacher's flush rate inside the relay's budget", () => {
    expect((60_000 / BOARD_UPDATE_MIN_MS)).toBeLessThan(BOARD_UPDATE_PER_MINUTE);
  });
});

describe("writer reconcile on board:current", () => {
  const base = { localVersion: 0, serverVersion: 0, localHasElements: false, serverHasElements: false, hasPendingEdit: false };

  it("republishes an edit made while offline", () => {
    expect(reconcileTeacherScene({ ...base, localVersion: 4, serverVersion: 4, localHasElements: true, serverHasElements: true, hasPendingEdit: true })).toBe("republish-local");
  });

  it("adopts the relay's board after a teacher reload", () => {
    expect(reconcileTeacherScene({ ...base, serverVersion: 6, serverHasElements: true })).toBe("adopt-server");
  });

  it("republishes when the relay lost the board (restart, sweep, eviction)", () => {
    expect(reconcileTeacherScene({ ...base, localVersion: 7, localHasElements: true })).toBe("republish-local");
  });

  it("publishes a prepared board the relay has never seen", () => {
    expect(reconcileTeacherScene({ ...base, localHasElements: true })).toBe("republish-local");
  });

  it("does nothing when both sides agree", () => {
    expect(reconcileTeacherScene({ ...base, localVersion: 5, serverVersion: 5, localHasElements: true, serverHasElements: true })).toBe("none");
  });

  it("never republishes a blank canvas over the relay's board", () => {
    expect(reconcileTeacherScene({ ...base, localVersion: 3, serverVersion: 1, serverHasElements: true })).toBe("none");
  });
});
