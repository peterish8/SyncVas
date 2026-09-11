/** SVRT1 room-token mint helpers for Next.js API routes (node:crypto). */

import { createHmac, randomBytes } from "node:crypto";

import { ROOM_TOKEN_TTL_SECONDS } from "../shared/constants/limits";

const SOCKET_TOKEN_TTL_SECONDS = ROOM_TOKEN_TTL_SECONDS;

export type RoomTokenRole = "teacher" | "student";

export function isProofSocketAllowed(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.NODE_ENV === "development" && env.ALLOW_PROOF_SOCKET === "1";
}

// One implementation, and it is the browser-safe one: see lib/room-token-expiry.ts
// for why the `Buffer`-based version returned null in every browser.
export { parseRoomTokenExpiry } from "./room-token-expiry";

export function encodeJsonPart(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function proofSubjectId(role: RoomTokenRole): string {
  if (role === "teacher") return "proof-teacher";
  return `proof-student-${randomBytes(6).toString("hex")}`;
}

export function signRoomToken(args: {
  sessionId: string;
  role: RoomTokenRole;
  subjectId: string;
  secret: string;
  now?: number;
  ttlSeconds?: number;
}): string {
  const secret = args.secret.trim();
  if (secret.length < 32) {
    throw new Error("SOCKET_INTERNAL_SECRET must be at least 32 characters.");
  }
  const now = args.now ?? Math.floor(Date.now() / 1000);
  const ttl = args.ttlSeconds ?? SOCKET_TOKEN_TTL_SECONDS;
  const header = encodeJsonPart({ alg: "HS256", typ: "SVRT1" });
  const payload = encodeJsonPart({
    v: 1,
    sessionId: args.sessionId,
    role: args.role,
    subjectId: args.subjectId,
    exp: now + ttl,
  });
  const input = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(input).digest("base64url");
  return `${input}.${signature}`;
}
