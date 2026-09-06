# SyncVas remediation plan

## Wave 1 — release blockers

1. Disable proof/local-teacher flags in production and verify authenticated teacher issuance with a deployed Convex environment.
2. Exercise the final snapshot path against Convex: draw, end, reload history, and confirm the exact scene is recoverable. Add storage-backed compression/preview when scenes exceed the inline bound.
3. Run reconnect tests with an unsent teacher edit, a stale `board:current`, and a tab refresh. Add an explicit publish acknowledgement so transport failure cannot be mistaken for success.

## Wave 2 — classroom reliability

1. Add session-end revocation to the relay (short-lived token plus a session-status check or signed close event).
2. Persist an active teacher session reference and restore it after refresh; reissue a fresh token rather than reusing an expired token.
3. Add viewport bounds/dimensions to the protocol and implement fit-to-view follow mode for different device sizes.
4. Re-check participant blocked state during token issuance and close the anonymous abuse-control path.

## Wave 3 — product completeness and polish

1. Implement doubts, votes, moderation, history, and export jobs behind their existing indexes and authorization boundaries.
2. Add hot-state cleanup on room end and TTL-based defensive eviction.
3. Replace `z.unknown()` scene/files with bounded structural schemas.
4. Split duplicate landing CSS, keep reduced-motion behavior, and run keyboard/screen-reader plus dark/light contrast audits.

## Exit criteria

- A production teacher can authenticate, start, draw, refresh, reconnect, end, and later recover the final board.
- A second teacher cannot mutate the room; an expired or ended session cannot publish.
- A late student receives the current scene and camera, and follow mode works on both desktop and mobile.
- Root and socket tests pass, plus production-build, 100-viewer smoke, 45-minute soak, and device UAT checks are recorded.
