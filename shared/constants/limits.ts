/**
 * @scaffold true
 * @phase 5+7
 * Product limits
 *
 * Doubt max length 220; rate limits per participant; viewport Hz; board throttle.
 *
 * Non-negotiables: validate public args; ownership checks; indexed queries;
 * internal work via internal functions; never log raw doubt text/secrets.
 */

export const DOUBT_MAX_CHARS = 220;
export const DOUBT_RATE_LIMIT_WINDOW_MS = 60_000;
export const DOUBT_RATE_LIMIT_MAX = 5;
export const TEACHER_VIEWPORT_MAX_HZ = 15;
export const BOARD_UPDATE_MIN_MS = 50;
