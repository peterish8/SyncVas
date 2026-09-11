/**
 * @scaffold true
 * @phase 5+7
 * Product limits
 *
 * Doubt max length 220; rate limits per participant; viewport Hz; board throttle;
 * board update budget; room token lifetime.
 *
 * Non-negotiables: validate public args; ownership checks; indexed queries;
 * internal work via internal functions; never log raw doubt text/secrets.
 */

export const DOUBT_MAX_CHARS = 220;
export const DOUBT_RATE_LIMIT_WINDOW_MS = 60_000;
export const DOUBT_RATE_LIMIT_MAX = 5;
export const TEACHER_VIEWPORT_MAX_HZ = 15;

/**
 * The relay's per-socket `board:update` budget and the teacher's flush floor.
 *
 * They live together because they are one contract: the client may publish at
 * most once per BOARD_UPDATE_MIN_MS (600/min), comfortably inside the relay's
 * budget. When the flush floor was 50 ms against a 600/min budget, thirty
 * seconds of fast handwriting got the teacher rate-limited.
 */
export const BOARD_UPDATE_MIN_MS = 100;
export const BOARD_UPDATE_PER_MINUTE = 900;

/**
 * SVRT1 room-token lifetime. Convex (production), the relay's test minter and
 * the dev proof route all mint with it, and the client schedules renewal from
 * it — measured on its own clock from receipt, never against the token's `exp`.
 */
export const ROOM_TOKEN_TTL_SECONDS = 5 * 60;
