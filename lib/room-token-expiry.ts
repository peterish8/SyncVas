/**
 * Client-safe SVRT1 room-token expiry reading.
 *
 * Kept apart from `lib/socket-token.ts` on purpose. That module mints tokens
 * with `node:crypto` and decoded them with `Buffer`, and neither exists in a
 * browser. The board sync hook imported `parseRoomTokenExpiry` from it, so in
 * every browser the decode threw inside its own try/catch and returned null —
 * which meant the proactive token-refresh timer never armed, and a tab that
 * dropped its socket after the five-minute TTL reconnected with a dead token
 * and sat on UNAUTHORIZED indefinitely.
 *
 * This file uses only `atob` and `TextDecoder`, available in browsers and in
 * Node 16+. It reads the `exp` claim without verifying the signature: the
 * relay is the verifier; the client only needs to know when to ask for more.
 */

function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function parseRoomTokenExpiry(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const decoded = JSON.parse(decodeBase64Url(payload)) as { exp?: unknown };
    return typeof decoded.exp === "number" && Number.isInteger(decoded.exp) ? decoded.exp : null;
  } catch {
    return null;
  }
}

/**
 * True only when the token carries a readable expiry that has passed.
 *
 * An unreadable token reports *not* expired. That is deliberate: callers use
 * this to decide whether to mint a replacement, and a token that can never be
 * parsed must not be able to drive an endless mint-and-reject loop.
 */
export function isRoomTokenExpired(token: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  const expiresAt = parseRoomTokenExpiry(token);
  return expiresAt !== null && expiresAt <= nowSeconds;
}
