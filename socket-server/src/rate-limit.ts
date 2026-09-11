/**
 * Per-socket sliding-window counters.
 *
 * State hangs off the socket, so it is collected when the socket disconnects and
 * needs no sweep of its own.
 */

export type RateLimitState = Map<string, number[]>;

export function createRateLimitState(): RateLimitState {
  return new Map();
}

/**
 * Record one hit and report whether the caller is still within budget.
 *
 * Returns true when the action is allowed.
 */
export function allowAction(
  state: RateLimitState,
  action: string,
  limitPerMinute: number,
  now = Date.now(),
): boolean {
  const windowStart = now - 60_000;
  const hits = state.get(action) ?? [];
  // Timestamps are appended in order, so dropping the expired prefix is enough.
  let firstLive = 0;
  while (firstLive < hits.length && hits[firstLive] <= windowStart) firstLive += 1;
  const live = firstLive > 0 ? hits.slice(firstLive) : hits;

  if (live.length >= limitPerMinute) {
    state.set(action, live);
    return false;
  }
  live.push(now);
  state.set(action, live);
  return true;
}
