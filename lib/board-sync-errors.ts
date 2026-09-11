/**
 * Classifies board-sync failures so the UI knows what to do with them.
 *
 * - `ended`      the class is over: show the terminal panel, stop reconnecting.
 * - `transient`  one frame was refused but the connection is fine: show the
 *                message briefly, then clear it (TRANSIENT_SYNC_ERROR_TTL_MS).
 * - `persistent` the connection cannot proceed as-is: keep the message up until
 *                the user acts or the connection recovers.
 *
 * Codes come from two transports: relay `protocol:error` frames
 * (socket-server/src/server.ts, socket-server/src/protocol.ts) and Convex
 * `ConvexError` payloads (`sessions.issueSocketToken`). See docs/28_ERROR_CODES.md.
 * Pure TypeScript, no React, so it is shared by the hook and its tests.
 */

import { extractErrorCode } from "@/lib/user-facing-errors";

export type SyncErrorKind = "ended" | "transient" | "persistent";

/** How long a transient sync error stays on screen before it clears itself. */
export const TRANSIENT_SYNC_ERROR_TTL_MS = 6000;

const ENDED_CODES: ReadonlySet<string> = new Set([
  // Relay evicted the room on End Class, or refused a socket for a revoked room.
  "ROOM_REVOKED",
  // issueSocketToken on an ended session.
  "SESSION_ENDED",
  // issueSocketToken on a session that is not live (in practice `ending`).
  "SESSION_NOT_LIVE",
]);

const TRANSIENT_CODES: ReadonlySet<string> = new Set([
  // Per-socket rate budget; the next frame after the window succeeds.
  "RATE_LIMITED",
  // A newer version already landed; the next update or board:current catches up.
  "STALE_BOARD_VERSION",
  // One malformed frame; the connection itself is healthy.
  "INVALID_PAYLOAD",
  // The hook refreshes the token automatically on this frame.
  "TOKEN_EXPIRED",
  // One oversized update; the next smaller one is accepted.
  "PAYLOAD_TOO_LARGE",
]);

export function classifySyncError(code: string): SyncErrorKind {
  if (ENDED_CODES.has(code)) return "ended";
  if (TRANSIENT_CODES.has(code)) return "transient";
  return "persistent";
}

/**
 * Stable code from anything a sync path can throw or receive.
 *
 * Reuses `extractErrorCode` for `ConvexError({ code, message })` payloads and
 * "CODE: detail" strings, and additionally accepts a bare "CODE" message, which
 * is what a relay handshake rejection (`connect_error`) carries, e.g.
 * `UNAUTHORIZED`.
 */
export function extractSyncErrorCode(error: unknown): string | null {
  const code = extractErrorCode(error);
  if (code) return code;
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const bare = message.trim();
  return /^[A-Z][A-Z0-9_]+$/.test(bare) ? bare : null;
}

/** True when a thrown error or received code means the class is over. */
export function isClassEndedError(error: unknown): boolean {
  const code = extractSyncErrorCode(error);
  return code !== null && classifySyncError(code) === "ended";
}
