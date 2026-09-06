/**
 * Room admission token helpers.
 * Prefer importing from server.ts in new code; this module re-exports to avoid a forever-null stub.
 */

export type { RoomClaims } from "./server.js";
export { mintRoomToken, verifyRoomToken } from "./server.js";
