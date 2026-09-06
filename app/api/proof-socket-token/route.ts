/** Dev/proof SVRT1 room tokens for Phase 2 board sync (not production admission). */

import { NextResponse } from "next/server";

import {
  isProofSocketAllowed,
  proofSubjectId,
  signRoomToken,
  type RoomTokenRole,
} from "@/lib/socket-token";

export const runtime = "nodejs";

function parseRole(value: unknown): RoomTokenRole | null {
  return value === "teacher" || value === "student" ? value : null;
}

function mintProofToken(sessionId: string, role: RoomTokenRole) {
  if (!isProofSocketAllowed()) {
    return NextResponse.json(
      { error: "Proof socket tokens are disabled outside development." },
      { status: 403 },
    );
  }

  const secret = process.env.SOCKET_INTERNAL_SECRET?.trim();
  if (!secret || secret.length < 32) {
    return NextResponse.json(
      { error: "SOCKET_INTERNAL_SECRET is not configured (min 32 chars)." },
      { status: 500 },
    );
  }

  const normalizedSessionId = sessionId.trim() || "proof-session";
  const token = signRoomToken({
    sessionId: normalizedSessionId,
    role,
    subjectId: proofSubjectId(role),
    secret,
  });
  return NextResponse.json({ token });
}

export function proofTokensEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "development" && env.ALLOW_PROOF_SOCKET === "1";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const role = parseRole(url.searchParams.get("role"));
  if (!role) {
    return NextResponse.json(
      { error: "role must be teacher or student." },
      { status: 400 },
    );
  }
  const sessionId = url.searchParams.get("sessionId") ?? "proof-session";
  return mintProofToken(sessionId, role);
}

export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const role = parseRole(record.role);
  if (!role) {
    return NextResponse.json(
      { error: "role must be teacher or student." },
      { status: 400 },
    );
  }
  const sessionId =
    typeof record.sessionId === "string" ? record.sessionId : "proof-session";
  return mintProofToken(sessionId, role);
}
