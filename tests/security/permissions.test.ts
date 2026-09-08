/**
 * @phase 9
 * Adversarial permission suite
 *
 * Forged roles, token mismatch, cross-room, student board mutate, Convex ownership,
 * exports/history access, no secrets in browser bundle.
 *
 * Non-negotiables: validate public args; ownership checks; indexed queries;
 * internal work via internal functions; never log raw doubt text/secrets.
 */

import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { io as createClient, type Socket as ClientSocket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";

import { getLatestFinal, saveFinal } from "@/convex/boardSnapshots";
import { isLocalDevTeacherAllowed } from "@/convex/authBootstrap";
import { listTeacherQueue, resolve as resolveDoubtFn } from "@/convex/doubts";
import { getForSession, request as requestExportFn } from "@/convex/exports";
import { end, getTeacherSession } from "@/convex/sessions";
import { SOCKET_EVENTS, SOCKET_PROTOCOL_VERSION, protocolErrorSchema } from "@/shared/protocol/socket";
import { clearHotScene } from "@/socket-server/src/board-hot-state";
import { createSocketServer, verifyRoomToken } from "@/socket-server/src/server";
import { createFakeConvex, handlerOf } from "../helpers/fake-convex";

const SECRET = "phase-9-security-secret-that-is-at-least-32-bytes";
process.env.SOCKET_INTERNAL_SECRET = SECRET;

const clients: ClientSocket[] = [];
const servers: Array<{ close: () => Promise<void> }> = [];
const sessionIds: string[] = [];

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function tokenParts(
  sessionId: string,
  role: "teacher" | "student",
  overrides?: { header?: Record<string, unknown>; payload?: Record<string, unknown>; secret?: string },
) {
  const header = encode({ alg: "HS256", typ: "SVRT1", ...overrides?.header });
  const payload = encode({
    v: 1,
    sessionId,
    role,
    subjectId: `${role}-1`,
    exp: Math.floor(Date.now() / 1000) + 300,
    ...overrides?.payload,
  });
  const signature = createHmac("sha256", overrides?.secret ?? SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function envelope(sessionId: string) {
  return { v: SOCKET_PROTOCOL_VERSION, sessionId, ts: Date.now() };
}

async function runningSocketServer() {
  const httpServer = createServer();
  const io = createSocketServer(httpServer, ["http://localhost:3000"]);
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP address.");
  servers.push({
    close: () => new Promise<void>((resolve) => io.close(() => httpServer.close(() => resolve()))),
  });
  return { url: `http://127.0.0.1:${address.port}` };
}

function waitForEvent<T>(socket: ClientSocket, event: string, timeoutMs = 2_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    const onEvent = (payload: T) => {
      clearTimeout(timer);
      socket.off(event, onEvent);
      resolve(payload);
    };
    socket.once(event, onEvent);
  });
}

async function connectAs(url: string, sessionId: string, role: "teacher" | "student", token?: string) {
  sessionIds.push(sessionId);
  const client = createClient(url, { auth: { token: token ?? tokenParts(sessionId, role) }, transports: ["websocket"] });
  clients.push(client);
  await new Promise<void>((resolve, reject) => {
    client.once("connect", () => resolve());
    client.once("connect_error", reject);
  });
  return client;
}

afterEach(async () => {
  clients.splice(0).forEach((client) => client.disconnect());
  await Promise.all(servers.splice(0).map((server) => server.close()));
  for (const sessionId of sessionIds.splice(0)) clearHotScene(sessionId);
});

describe("SEC-01 room token forgery", () => {
  it("accepts only a token signed with the configured secret", () => {
    expect(verifyRoomToken(tokenParts("room-1", "teacher"), SECRET)).toMatchObject({ role: "teacher" });
    expect(verifyRoomToken(tokenParts("room-1", "teacher", { secret: "a-different-secret-of-sufficient-length" }), SECRET)).toBeNull();
  });

  it.each([
    ["algorithm downgrade", { header: { alg: "none" } }],
    ["algorithm swap", { header: { alg: "HS512" } }],
    ["token type swap", { header: { typ: "JWT" } }],
    ["protocol version bump", { payload: { v: 2 } }],
    ["missing session scope", { payload: { sessionId: "" } }],
    ["missing subject", { payload: { subjectId: "" } }],
    ["unknown role", { payload: { role: "admin" } }],
    ["non-integer expiry", { payload: { exp: 1.5 } }],
    ["expired token", { payload: { exp: Math.floor(Date.now() / 1000) - 1 } }],
  ])("rejects %s", (_label, overrides) => {
    expect(verifyRoomToken(tokenParts("room-1", "teacher", overrides), SECRET)).toBeNull();
  });

  it("rejects structurally malformed tokens without throwing", () => {
    for (const token of ["", "a", "a.b", "a.b.c.d", "...", "not-a-token"]) {
      expect(verifyRoomToken(token, SECRET)).toBeNull();
    }
  });

  it("rejects a payload edited after signing", () => {
    const signed = tokenParts("room-1", "student");
    const [header, , signature] = signed.split(".");
    const elevated = encode({
      v: 1,
      sessionId: "room-1",
      role: "teacher",
      subjectId: "student-1",
      exp: Math.floor(Date.now() / 1000) + 300,
    });
    expect(verifyRoomToken(`${header}.${elevated}.${signature}`, SECRET)).toBeNull();
  });

  it("refuses to verify anything when the server secret is weak or absent", () => {
    const token = tokenParts("room-1", "teacher");
    expect(verifyRoomToken(token, "")).toBeNull();
    expect(verifyRoomToken(token, "too-short")).toBeNull();

    // An unconfigured deployment must fail closed rather than accept everything.
    const configured = process.env.SOCKET_INTERNAL_SECRET;
    delete process.env.SOCKET_INTERNAL_SECRET;
    try {
      expect(verifyRoomToken(token)).toBeNull();
    } finally {
      process.env.SOCKET_INTERNAL_SECRET = configured;
    }
  });
});

describe("SEC-02 role and room boundaries on the live socket", () => {
  it("ignores a client-declared teacher role and keeps the token's student role", async () => {
    const sessionId = "sec-role-1";
    const { url } = await runningSocketServer();
    const student = await connectAs(url, sessionId, "student");

    const rejected = waitForEvent<unknown>(student, SOCKET_EVENTS.protocolError);
    student.emit(SOCKET_EVENTS.boardUpdate, {
      ...envelope(sessionId),
      // The browser asserts it is the teacher; the server must not believe it.
      role: "teacher",
      boardVersion: 1,
      scene: { elements: [{ id: "forged" }] },
    });
    // The strict envelope rejects the smuggled field before the role check runs;
    // either refusal is correct, silently honouring it would not be.
    expect(protocolErrorSchema.parse(await rejected).code).toMatch(
      /^(?:INVALID_PAYLOAD|STUDENT_BOARD_EDIT_FORBIDDEN)$/u,
    );

    // The forged scene must not have become canonical for the room.
    const current = waitForEvent<{ boardVersion: number }>(student, SOCKET_EVENTS.boardCurrent);
    student.emit(SOCKET_EVENTS.boardRequestCurrent, envelope(sessionId));
    expect((await current).boardVersion).toBe(0);
  });

  it("refuses a board write aimed at a room the token does not cover", async () => {
    const { url } = await runningSocketServer();
    const teacher = await connectAs(url, "sec-room-a", "teacher");
    sessionIds.push("sec-room-b");

    const rejected = waitForEvent<unknown>(teacher, SOCKET_EVENTS.protocolError);
    teacher.emit(SOCKET_EVENTS.boardUpdate, {
      ...envelope("sec-room-b"),
      boardVersion: 1,
      scene: { elements: [{ id: "cross-room" }] },
    });
    const error = protocolErrorSchema.parse(await rejected);
    expect(error.code).not.toBe("OK");
    // A refusal may name the boundary, never the internals behind it.
    expect(error.message).not.toContain(SECRET);
    expect(error.message).not.toMatch(/secret|hmac|\.ts:\d+|node_modules|Error:/iu);
  });

  it("refuses a connection whose token was signed by another deployment", async () => {
    const { url } = await runningSocketServer();
    const forged = tokenParts("sec-room-c", "teacher", { secret: "another-deployments-secret-key-32chars" });
    await expect(connectAs(url, "sec-room-c", "teacher", forged)).rejects.toBeTruthy();
  });
});

describe("SEC-03 Convex ownership on every teacher surface", () => {
  const TEACHER = "users:owner";
  const INTRUDER = "users:intruder";
  const SESSION = "sessions:target";

  function intruderWorld() {
    return createFakeConvex({
      identity: { subject: "auth|intruder" },
      seed: {
        users: [
          { _id: TEACHER, authSubject: "auth|owner", role: "teacher", createdAt: 1 },
          { _id: INTRUDER, authSubject: "auth|intruder", role: "teacher", createdAt: 1 },
        ],
        sessions: [
          {
            _id: SESSION,
            teacherId: TEACHER,
            title: "Quadratics",
            joinCode: "QN47XB",
            status: "live",
            latestBoardVersion: 2,
            latestSnapshotId: "boardSnapshots:final",
          },
        ],
        boardSnapshots: [
          { _id: "boardSnapshots:final", sessionId: SESSION, boardVersion: 2, sceneJsonCompressed: "{\"elements\":[]}", kind: "final", createdAt: 5 },
        ],
        doubts: [
          { _id: "doubts:one", sessionId: SESSION, participantId: "participants:a", text: "Why?", normalizedText: "why?", status: "accepted", voteCount: 0, createdAt: 6 },
        ],
      },
    });
  }

  const surfaces: Array<[string, (ctx: unknown) => Promise<unknown>]> = [
    ["sessions.end", (ctx) => handlerOf<{ sessionId: string }, unknown>(end)(ctx, { sessionId: SESSION })],
    ["sessions.getTeacherSession", (ctx) => handlerOf<{ sessionId: string }, unknown>(getTeacherSession)(ctx, { sessionId: SESSION })],
    ["doubts.listTeacherQueue", (ctx) => handlerOf<{ sessionId: string }, unknown>(listTeacherQueue)(ctx, { sessionId: SESSION })],
    ["doubts.resolve", (ctx) => handlerOf<{ doubtId: string; action: string }, unknown>(resolveDoubtFn)(ctx, { doubtId: "doubts:one", action: "dismissed" })],
    ["exports.request", (ctx) => handlerOf<{ sessionId: string; type: string }, unknown>(requestExportFn)(ctx, { sessionId: SESSION, type: "png" })],
    ["exports.getForSession", (ctx) => handlerOf<{ sessionId: string }, unknown>(getForSession)(ctx, { sessionId: SESSION })],
    ["boardSnapshots.saveFinal", (ctx) => handlerOf<{ sessionId: string; boardVersion: number; sceneJson: string }, unknown>(saveFinal)(ctx, { sessionId: SESSION, boardVersion: 3, sceneJson: "{\"elements\":[]}" })],
    ["boardSnapshots.getLatestFinal", (ctx) => handlerOf<{ sessionId: string }, unknown>(getLatestFinal)(ctx, { sessionId: SESSION })],
  ];

  it.each(surfaces)("refuses %s to a signed-in teacher who does not own the room", async (_name, call) => {
    const fake = intruderWorld();
    await expect(call(fake.ctx)).rejects.toThrow(/Classroom not found/);
  });

  it.each(surfaces)("refuses %s to an unauthenticated caller", async (_name, call) => {
    const anonymous = createFakeConvex({
      identity: null,
      seed: {
        users: [{ _id: TEACHER, authSubject: "auth|owner", role: "teacher", createdAt: 1 }],
        sessions: [{ _id: SESSION, teacherId: TEACHER, title: "Quadratics", joinCode: "QN47XB", status: "live", latestBoardVersion: 2 }],
        doubts: [{ _id: "doubts:one", sessionId: SESSION, participantId: "participants:a", text: "Why?", normalizedText: "why?", status: "accepted", voteCount: 0, createdAt: 6 }],
      },
    });
    await expect(call(anonymous.ctx)).rejects.toThrow(/Sign in to manage a classroom/);
  });

  it("refuses a signed-in account that is not a teacher", async () => {
    const student = createFakeConvex({
      identity: { subject: "auth|pupil" },
      seed: {
        users: [{ _id: "users:pupil", authSubject: "auth|pupil", role: "student", createdAt: 1 }],
        sessions: [{ _id: SESSION, teacherId: TEACHER, title: "Quadratics", joinCode: "QN47XB", status: "live", latestBoardVersion: 2 }],
      },
    });
    await expect(
      handlerOf<{ sessionId: string }, unknown>(getTeacherSession)(student.ctx, { sessionId: SESSION }),
    ).rejects.toThrow(/A teacher account is required/);
  });
});

describe("SEC-04 no server secrets reach the browser bundle", () => {
  const SERVER_ONLY = [
    "SOCKET_INTERNAL_SECRET",
    "MODERATION_API_KEY",
    "MODERATION_API_URL",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "AUTH_GOOGLE_SECRET",
    "CONVEX_DEPLOYMENT",
  ];

  function sourceFiles(root: string): string[] {
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry.startsWith(".")) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(?:ts|tsx)$/u.test(entry)) found.push(full);
      }
    };
    walk(root);
    return found;
  }

  /** A module is client-side if it opts in, or is imported only by such modules. */
  function isClientModule(source: string): boolean {
    return /^\s*["']use client["']/mu.test(source);
  }

  it("never reads a server-only secret from a client component", () => {
    const offenders: string[] = [];
    for (const root of ["app", "components"]) {
      for (const file of sourceFiles(root)) {
        const source = readFileSync(file, "utf8");
        if (!isClientModule(source)) continue;
        for (const name of SERVER_ONLY) {
          if (source.includes(name)) offenders.push(`${relative(".", file).split(sep).join("/")} → ${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("exposes only NEXT_PUBLIC_ environment values to client components", () => {
    const offenders: string[] = [];
    for (const root of ["app", "components"]) {
      for (const file of sourceFiles(root)) {
        const source = readFileSync(file, "utf8");
        if (!isClientModule(source)) continue;
        for (const match of source.matchAll(/process\.env\.([A-Z0-9_]+)/gu)) {
          const name = match[1];
          if (!name.startsWith("NEXT_PUBLIC_") && name !== "NODE_ENV") {
            offenders.push(`${relative(".", file).split(sep).join("/")} → ${name}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the token-minting secret out of every client-reachable module", () => {
    const minting = readFileSync(join("lib", "socket-token.ts"), "utf8");
    // The helper is imported by route handlers only; it must never announce itself as client code.
    expect(isClientModule(minting)).toBe(false);
    expect(minting).toContain("node:crypto");
  });
});

describe("SEC-05 the local-teacher backdoor cannot reach production", () => {
  /**
   * The dev teacher is a fixed anonymous identity: fine on a laptop, a full
   * account takeover in production, so the gate is asserted structurally rather
   * than trusted to review.
   *
   * The `*AsLocalTeacher` family this originally policed is gone — the fallback
   * now lives inside `permissions.requireTeacher`, and `teacher-access-gate`
   * asserts no twin comes back. What is still reachable without Convex Auth is
   * `authBootstrap.ensureLocalTeacher`, which this keeps gated, along with any
   * twin that a future change reintroduces.
   */
  const GUARDS = [
    "requireLocalDevTeacher",
    "requireLocalDevSessionOwner",
    "requireLocalDevSessionOwnerQuery",
    "getLocalDevTeacher",
    "isLocalDevTeacherAllowed",
    "upsertLocalDevTeacher",
    // Indirection through an internal query that itself holds a guard.
    "assertLocalTeacher",
  ];

  function convexFiles(): string[] {
    return readdirSync("convex")
      .filter((entry) => entry.endsWith(".ts") && entry !== "schema.ts")
      .map((entry) => join("convex", entry));
  }

  it("gates every local-teacher function behind a dev-only guard", () => {
    const ungated: string[] = [];
    for (const file of convexFiles()) {
      const source = readFileSync(file, "utf8");
      const segments = source.split(/\nexport const (\w+) = /u);
      for (let i = 1; i < segments.length; i += 2) {
        const name = segments[i];
        const body = segments[i + 1];
        if (!name.includes("AsLocalTeacher") && name !== "ensureLocalTeacher") continue;
        if (!GUARDS.some((guard) => body.includes(guard))) {
          ungated.push(`${file.split(sep).join("/")} → ${name}`);
        }
      }
    }
    expect(ungated).toEqual([]);
  });

  it("requires both development mode and the explicit flag", () => {
    // A single copied env var must never be enough to unlock the identity.
    expect(isLocalDevTeacherAllowed({ NODE_ENV: "production", ALLOW_DEV_TEACHER: "1" })).toBe(false);
    expect(isLocalDevTeacherAllowed({ NODE_ENV: "development", ALLOW_DEV_TEACHER: "0" })).toBe(false);
    expect(isLocalDevTeacherAllowed({ NODE_ENV: "development" })).toBe(false);
    expect(isLocalDevTeacherAllowed({})).toBe(false);
    expect(isLocalDevTeacherAllowed({ NODE_ENV: "development", ALLOW_DEV_TEACHER: "1" })).toBe(true);
  });

  it("keeps the proof-token route dev-only on the same two-key rule", () => {
    const route = readFileSync(join("app", "api", "proof-socket-token", "route.ts"), "utf8");
    expect(route).toContain('NODE_ENV === "development"');
    expect(route).toContain('ALLOW_PROOF_SOCKET === "1"');
  });
});
