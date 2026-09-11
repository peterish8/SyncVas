/** Phase 3 room admission/lifecycle security contract. */

import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { io as createClient, type Socket as ClientSocket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";

import { ensureLocalTeacher, isLocalDevTeacherAllowed } from "@/convex/authBootstrap";
import {
  end,
  getTeacherDashboard,
  getTeacherForToken,
  issueSocketToken,
  JOIN_CODE_PATTERN,
} from "@/convex/sessions";
import { countForSession, joinByCode } from "@/convex/participants";
import { createFakeConvex, handlerOf } from "./helpers/fake-convex";
import {
  SOCKET_EVENTS,
  SOCKET_PROTOCOL_VERSION,
  protocolErrorSchema,
} from "@/shared/protocol/socket";
import { createSocketServer, verifyRoomToken } from "@/socket-server/src/server";

const SECRET = "phase-3-test-secret-that-is-at-least-32-bytes";
process.env.SOCKET_INTERNAL_SECRET = SECRET;
const clients: ClientSocket[] = [];
const servers: Array<{ close: () => Promise<void> }> = [];

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signedToken(sessionId: string, role: "teacher" | "student", subjectId = "subject-1", expiresInSeconds = 300): string {
  const header = encode({ alg: "HS256", typ: "SVRT1" });
  const payload = encode({ v: 1, sessionId, role, subjectId, exp: Math.floor(Date.now() / 1000) + expiresInSeconds });
  const signature = createHmac("sha256", SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
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
  return { io, url: `http://127.0.0.1:${address.port}` };
}

function connect(url: string, token: string): ClientSocket {
  const client = createClient(url, { auth: { token }, transports: ["websocket"] });
  clients.push(client);
  return client;
}

afterEach(async () => {
  clients.splice(0).forEach((client) => client.disconnect());
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("room lifecycle and anonymous admission", () => {
  it("accepts only six-character, ambiguity-safe join codes", () => {
    expect(JOIN_CODE_PATTERN.test("ABCD23")).toBe(true);
    expect(JOIN_CODE_PATTERN.test("ABC0O1")).toBe(false);
    expect(JOIN_CODE_PATTERN.test("short")).toBe(false);
  });

  it("enforces session ownership before teacher lifecycle operations", async () => {
    const ctx = {
      auth: { getUserIdentity: async () => ({ subject: "teacher-b" }) },
      db: {
        query: () => ({
          withIndex: () => ({ unique: async () => ({ _id: "teacher-b", role: "teacher" }) }),
        }),
        // requireTeacher resolves the caller through ctx.db.get(userId) before
        // comparing owners, so the stub must answer for the user id too — not
        // hand back the session for every lookup.
        get: async (id: string) =>
          id === "teacher-b"
            ? { _id: "teacher-b", role: "teacher" }
            : { _id: "session-a", teacherId: "teacher-a", status: "live" },
      },
    } as never;

    const endHandler = (end as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> })._handler;
    await expect(endHandler(ctx, { sessionId: "session-a" })).rejects.toThrow("Classroom not found");
  });

  it("gates local teacher bootstrap on ALLOW_DEV_TEACHER", async () => {
    const env = process.env as Record<string, string | undefined>;
    const previous = env.ALLOW_DEV_TEACHER;
    const previousNodeEnv = env.NODE_ENV;
    env.NODE_ENV = "development";
    delete env.ALLOW_DEV_TEACHER;
    expect(isLocalDevTeacherAllowed()).toBe(false);

    const ensureHandler = (
      ensureLocalTeacher as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> }
    )._handler;
    await expect(ensureHandler({ db: {} }, {})).rejects.toThrow("DEV_TEACHER_DISABLED");

    env.ALLOW_DEV_TEACHER = "1";
    expect(isLocalDevTeacherAllowed()).toBe(true);

    const ctx = {
      db: {
        query: () => ({
          withIndex: () => ({ unique: async () => null }),
        }),
        insert: async () => "teacher-local",
        get: async () => ({
          _id: "teacher-local",
          authSubject: "local-dev-teacher",
          role: "teacher",
          createdAt: 1,
        }),
      },
    } as never;
    await expect(ensureHandler(ctx, {})).resolves.toEqual({
      teacherId: "teacher-local",
      authSubject: "local-dev-teacher",
    });

    if (previous === undefined) delete env.ALLOW_DEV_TEACHER;
    else env.ALLOW_DEV_TEACHER = previous;
    if (previousNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previousNodeEnv;
  });

  // The dev identity is resolved inside permissions.requireTeacher now, so this
  // exercises the same ownership rule through the single `end` mutation rather
  // than through a dev-only twin.
  it("enforces ownership when the dev teacher is the resolved identity", async () => {
    const env = process.env as Record<string, string | undefined>;
    const previous = env.ALLOW_DEV_TEACHER;
    const previousNodeEnv = env.NODE_ENV;
    env.NODE_ENV = "development";
    env.ALLOW_DEV_TEACHER = "1";
    const ctx = {
      auth: { getUserIdentity: async () => null },
      db: {
        query: () => ({
          withIndex: () => ({
            unique: async () => ({
              _id: "teacher-local",
              authSubject: "local-dev-teacher",
              role: "teacher",
            }),
          }),
        }),
        get: async () => ({ _id: "session-a", teacherId: "other-teacher", status: "live" }),
      },
    } as never;
    const endHandler = (
      end as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> }
    )._handler;
    await expect(endHandler(ctx, { sessionId: "session-a" })).rejects.toThrow("Classroom not found");
    if (previous === undefined) delete env.ALLOW_DEV_TEACHER;
    else env.ALLOW_DEV_TEACHER = previous;
    if (previousNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previousNodeEnv;
  });

  it("rejects anonymous admission after a room has ended", async () => {
    const ctx = {
      db: {
        query: () => ({
          withIndex: (_name: string, callback: (query: { eq: () => unknown }) => unknown) => {
            callback({ eq: () => undefined });
            return { unique: async () => ({ _id: "session-ended", status: "ended", joinCode: "ABCD23" }) };
          },
        }),
      },
    };
    const joinHandler = (joinByCode as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> })._handler;
    await expect(joinHandler(ctx, { code: "ABCD23", anonymousProof: "proof-that-is-long-enough" })).rejects.toThrow("SESSION_ENDED");
  });

  it("does not reissue a socket token to a currently blocked participant", async () => {
    const issueHandler = (
      issueSocketToken as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> }
    )._handler;
    const blockedUntil = Date.now() + 60_000;
    const ctx = {
      auth: { getUserIdentity: async () => null },
      runQuery: async (_reference: unknown, args: { sessionId?: string; participantId?: string }) => {
        if (args.sessionId) {
          return { _id: "session-a", teacherId: "teacher-a", status: "live" };
        }
        if (args.participantId) {
          return { participantId: "participant-a", sessionId: "session-a", blockedUntil };
        }
        return null;
      },
    } as never;

    await expect(
      issueHandler(ctx, { sessionId: "session-a", participantId: "participant-a" }),
    ).rejects.toThrow("PARTICIPANT_BLOCKED");
  });

  it("resolves non-id auth subjects without passing them to db.get", async () => {
    const teacher = { _id: "teacher-local", authSubject: "local-dev-teacher", role: "teacher" };
    const ctx = {
      db: {
        query: () => ({
          withIndex: () => ({ unique: async () => teacher }),
        }),
        get: async () => {
          throw new Error("invalid Convex id should not be decoded");
        },
      },
    } as never;
    const getTeacherHandler = (
      getTeacherForToken as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> }
    )._handler;

    await expect(getTeacherHandler(ctx, { subject: "local-dev-teacher" })).resolves.toEqual(teacher);
  });

  it("rejects a forged or expired room token before room admission", () => {
    const token = signedToken("session-a", "student");
    expect(verifyRoomToken(token, SECRET)).toMatchObject({ sessionId: "session-a", role: "student" });
    const parts = token.split(".");
    const forgedPayload = encode({ v: 1, sessionId: "session-a", role: "teacher", subjectId: "subject-1", exp: Math.floor(Date.now() / 1000) + 300 });
    expect(verifyRoomToken(`${parts[0]}.${forgedPayload}.${parts[2]}`, SECRET)).toBeNull();
    expect(verifyRoomToken(signedToken("session-a", "student").replace(/[^.]+$/, "bad"), SECRET)).toBeNull();
    expect(verifyRoomToken(signedToken("session-a", "student", "subject-1", -1), SECRET)).toBeNull();
  });

  it("rejects role spoofing and cross-room joins with safe, versioned errors", async () => {
    const { url } = await runningSocketServer();
    const student = connect(url, signedToken("session-a", "student"));
    await new Promise<void>((resolve, reject) => {
      student.once("connect", resolve);
      student.once("connect_error", reject);
    });

    const error = new Promise<unknown>((resolve) => student.once(SOCKET_EVENTS.protocolError, resolve));
    student.emit(SOCKET_EVENTS.roomJoin, {
      v: SOCKET_PROTOCOL_VERSION,
      sessionId: "session-b",
      ts: Date.now(),
      role: "teacher",
      secret: "do-not-echo",
    });
    const payload = protocolErrorSchema.parse(await error);
    expect(payload).toMatchObject({ code: "INVALID_PAYLOAD" });
    expect(JSON.stringify(payload)).not.toContain("do-not-echo");

    const mismatch = new Promise<unknown>((resolve) => student.once(SOCKET_EVENTS.protocolError, resolve));
    student.emit(SOCKET_EVENTS.roomJoin, {
      v: SOCKET_PROTOCOL_VERSION,
      sessionId: "session-b",
      ts: Date.now(),
    });
    expect(protocolErrorSchema.parse(await mismatch)).toMatchObject({ code: "ROOM_MISMATCH" });
  });
});

describe("COST-02 the participant count is a counter, not a collect", () => {
  const TEACHER = "users:owner";
  const SESSION = "sessions:live";

  const join = handlerOf<
    { code: string; anonymousProof: string; displayName?: string },
    { participantId: string }
  >(joinByCode);
  const count = handlerOf<{ sessionId: string }, { connectedCount: number }>(countForSession);
  const dashboard = handlerOf<Record<string, never>, { totals: { studentJoins: number } }>(getTeacherDashboard);

  function room() {
    return createFakeConvex({
      identity: { subject: "auth|owner" },
      seed: {
        users: [{ _id: TEACHER, authSubject: "auth|owner", role: "teacher", createdAt: 1 }],
        sessions: [
          {
            _id: SESSION,
            teacherId: TEACHER,
            title: "Quadratics",
            joinCode: "QN47XB",
            status: "live",
            latestBoardVersion: 0,
          },
        ],
      },
    });
  }

  it("counts a student once, however many times they rejoin", async () => {
    const fake = room();
    const proof = "anonymous-proof-long-enough";

    await join(fake.ctx, { code: "QN47XB", anonymousProof: proof });
    expect(await count(fake.ctx, { sessionId: SESSION })).toEqual({ connectedCount: 1 });

    // A refresh re-runs joinByCode with the same proof. It must patch lastSeenAt and
    // leave the counter alone, or a class of 30 reports hundreds of students.
    await join(fake.ctx, { code: "QN47XB", anonymousProof: proof });
    await join(fake.ctx, { code: "QN47XB", anonymousProof: proof });
    expect(fake.rows("participants")).toHaveLength(1);
    expect(await count(fake.ctx, { sessionId: SESSION })).toEqual({ connectedCount: 1 });

    await join(fake.ctx, { code: "QN47XB", anonymousProof: "a-different-anonymous-proof" });
    expect(await count(fake.ctx, { sessionId: SESSION })).toEqual({ connectedCount: 2 });
  });

  it("answers the count without reading a participant row", async () => {
    const fake = room();
    await join(fake.ctx, { code: "QN47XB", anonymousProof: "anonymous-proof-long-enough" });

    fake.resetReads();
    await count(fake.ctx, { sessionId: SESSION });
    expect(fake.readsOf("participants")).toHaveLength(0);
  });

  it("builds the teacher dashboard without fanning out over participants", async () => {
    const fake = room();
    await join(fake.ctx, { code: "QN47XB", anonymousProof: "anonymous-proof-long-enough" });
    await join(fake.ctx, { code: "QN47XB", anonymousProof: "a-different-anonymous-proof" });

    fake.resetReads();
    const result = await dashboard(fake.ctx, {});
    expect(result.totals.studentJoins).toBe(2);
    // The collect this replaced re-read every participant of every class the teacher
    // owns each time any doubt submission patched a lastSeenAt.
    expect(fake.readsOf("participants")).toHaveLength(0);
  });
});
