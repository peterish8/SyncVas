/**
 * Pure decisions behind the board sync hook and canvas.
 *
 * Kept free of React and sockets so every rule that decides whether the board
 * stays in sync can be tested directly. The hook and canvas only wire these to
 * events.
 */

import { ROOM_TOKEN_TTL_SECONDS } from "@/shared/constants/limits";
import type { BoardUpdateAck } from "@/shared/protocol/socket";

/** Renew this long before the token lapses. */
export const TOKEN_REFRESH_LEAD_SECONDS = 60;

/**
 * Floor on any scheduled renewal. A misjudged schedule then costs at most one
 * mint per this interval, never a tight loop against Convex.
 */
export const MIN_TOKEN_REFRESH_DELAY_MS = 30_000;

/** Minimum gap between mints triggered by a refused handshake. */
export const HANDSHAKE_REFRESH_COOLDOWN_MS = 30_000;

/**
 * Delay until a token received at `receivedAtMs` should be renewed.
 *
 * Both instants come from the client's own clock, so a device whose clock is
 * minutes off still renews on time. Comparing the server-minted `exp` against
 * `Date.now()` used to schedule a zero delay on a fast clock — mint, reconnect,
 * mint again, forever — and a late renewal on a slow one.
 */
export function tokenRefreshDelayMs(
  receivedAtMs: number,
  nowMs: number,
  ttlSeconds: number = ROOM_TOKEN_TTL_SECONDS,
): number {
  const dueAtMs = receivedAtMs + (ttlSeconds - TOKEN_REFRESH_LEAD_SECONDS) * 1000;
  return Math.max(MIN_TOKEN_REFRESH_DELAY_MS, dueAtMs - nowMs);
}

/** True once a token received at `receivedAtMs` is inside its renewal window. */
export function isTokenRefreshDue(
  receivedAtMs: number,
  nowMs: number,
  ttlSeconds: number = ROOM_TOKEN_TTL_SECONDS,
): boolean {
  return nowMs >= receivedAtMs + (ttlSeconds - TOKEN_REFRESH_LEAD_SECONDS) * 1000;
}

/**
 * Whether a refused handshake may mint another token.
 *
 * Gated on elapsed time rather than the token's own expiry: a wrong device clock
 * misreads expiry, and a token the relay rejects for another reason (secret
 * mismatch) must not drive a mint-reject loop.
 */
export function mayRefreshAfterHandshakeFailure(lastAttemptAtMs: number | null, nowMs: number): boolean {
  return lastAttemptAtMs === null || nowMs - lastAttemptAtMs >= HANDSHAKE_REFRESH_COOLDOWN_MS;
}

/**
 * Whether a received board version should replace the local scene.
 *
 * Every update carries the full scene, so any strictly newer version is safe to
 * apply even when versions were skipped. Treating a skip as a gap that needs a
 * resync used to freeze a student whenever that resync request was refused.
 * Version 0 is the empty opening board and is accepted while nothing newer is held.
 */
export function shouldApplyBoardVersion(incoming: number, latest: number): boolean {
  if (incoming > latest) return true;
  return incoming === 0 && latest === 0;
}

/**
 * The writer's committed version after a `board:update` acknowledgement.
 *
 * A version is committed only once the relay accepts it, so a rejected update no
 * longer burns a number. A stale rejection carries the relay's version, which the
 * writer adopts so its retry lands above it.
 */
export function nextVersionAfterAck(latest: number, ack: BoardUpdateAck): number {
  const relayVersion = "boardVersion" in ack ? ack.boardVersion : undefined;
  return typeof relayVersion === "number" ? Math.max(latest, relayVersion) : latest;
}

/** True when a failed publish should be retried at once rather than after a pause. */
export function shouldRetryPublishImmediately(ack: BoardUpdateAck): boolean {
  return !ack.ok && ack.code === "STALE_BOARD_VERSION";
}

export type TeacherReconcile = "adopt-server" | "republish-local" | "none";

/**
 * What the writer does when the relay reports its current board on (re)connect.
 *
 * The teacher's canvas is the authority. The relay's copy is a cache that a
 * restart, the idle sweep or the room cap can empty, so a relay that is behind a
 * non-empty local scene gets the local scene republished — otherwise late joiners
 * would see a blank board until the teacher happened to draw again. A reloaded
 * teacher with an empty canvas adopts the relay's scene instead of blanking it.
 */
export function reconcileTeacherScene(args: {
  localVersion: number;
  serverVersion: number;
  localHasElements: boolean;
  serverHasElements: boolean;
  hasPendingEdit: boolean;
}): TeacherReconcile {
  if (args.hasPendingEdit) return "republish-local";
  if (args.serverVersion > args.localVersion) return "adopt-server";
  if (!args.localHasElements) return "none";
  if (args.serverVersion < args.localVersion) return "republish-local";
  return args.serverHasElements ? "none" : "republish-local";
}
