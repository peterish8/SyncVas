/**
 * The permissions seam, tested at its own interface.
 *
 * Every authorization check in the product crosses `convex/permissions.ts`, but
 * it was only ever exercised *past* the seam — through boardSnapshots, doubts,
 * exports, sessions and quiz — so each feature re-proved ownership and a new
 * module got no coverage until someone remembered to re-prove it again.
 *
 * That matters more now that the dev-teacher fallback lives here: collapsing the
 * 30 `*AsLocalTeacher` twins moved behaviour behind this seam, and behaviour
 * behind a seam needs a test at the seam.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  requireParticipantInSession,
  requireSessionOwner,
  requireTeacher,
} from "@/convex/permissions";
import { createFakeConvex } from "./helpers/fake-convex";

const TEACHER = "users:owner";
const OTHER_TEACHER = "users:intruder";
const SESSION = "sessions:live";
const PARTICIPANT = "participants:anon-a";

const env = process.env as Record<string, string | undefined>;
let savedNodeEnv: string | undefined;
let savedDevTeacher: string | undefined;

beforeEach(() => {
  savedNodeEnv = env.NODE_ENV;
  savedDevTeacher = env.ALLOW_DEV_TEACHER;
});

afterEach(() => {
  if (savedNodeEnv === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = savedNodeEnv;
  if (savedDevTeacher === undefined) delete env.ALLOW_DEV_TEACHER;
  else env.ALLOW_DEV_TEACHER = savedDevTeacher;
});

function world(options?: { identity?: string | null; users?: Record<string, unknown>[] }) {
  return createFakeConvex({
    identity: options?.identity === null ? undefined : { subject: options?.identity ?? "auth|owner" },
    seed: {
      users: options?.users ?? [
        { _id: TEACHER, authSubject: "auth|owner", role: "teacher", createdAt: 1 },
        { _id: OTHER_TEACHER, authSubject: "auth|intruder", role: "teacher", createdAt: 1 },
      ],
      sessions: [
        { _id: SESSION, teacherId: TEACHER, title: "Quadratics", joinCode: "QN47XB", status: "live", latestBoardVersion: 0 },
      ],
      participants: [
        { _id: PARTICIPANT, sessionId: SESSION, anonymousIdHash: "hash-a", joinedAt: 1, lastSeenAt: 1, doubtCount: 0 },
      ],
    },
  });
}

describe("requireTeacher", () => {
  it("resolves an authenticated teacher by auth subject", async () => {
    const fake = world();
    const teacher = await requireTeacher(fake.ctx);
    expect(teacher._id).toBe(TEACHER);
  });

  it("refuses a subject with no teacher row", async () => {
    const fake = world({ identity: "auth|nobody" });
    await expect(requireTeacher(fake.ctx)).rejects.toThrow(/teacher account is required/i);
  });

  it("refuses a user whose role is not teacher or admin", async () => {
    const fake = world({
      identity: "auth|student",
      users: [{ _id: "users:student", authSubject: "auth|student", role: "student", createdAt: 1 }],
    });
    await expect(requireTeacher(fake.ctx)).rejects.toThrow(/teacher account is required/i);
  });

  it("refuses an unauthenticated caller when the dev teacher is off", async () => {
    env.NODE_ENV = "production";
    delete env.ALLOW_DEV_TEACHER;
    const fake = world({ identity: null });
    await expect(requireTeacher(fake.ctx)).rejects.toThrow(/sign in/i);
  });
});

/**
 * The dev fallback is the behaviour that moved here from 30 twins, so both keys
 * of the two-key gate get an explicit case.
 */
describe("requireTeacher — dev identity fallback", () => {
  const localUser = {
    _id: "users:local",
    authSubject: "local-dev-teacher",
    role: "teacher",
    createdAt: 1,
  };

  it("resolves the local dev teacher when both keys are set", async () => {
    env.NODE_ENV = "development";
    env.ALLOW_DEV_TEACHER = "1";
    const fake = world({ identity: null, users: [localUser] });
    const teacher = await requireTeacher(fake.ctx);
    expect(teacher._id).toBe("users:local");
  });

  it("does not fall back when ALLOW_DEV_TEACHER is unset", async () => {
    env.NODE_ENV = "development";
    delete env.ALLOW_DEV_TEACHER;
    const fake = world({ identity: null, users: [localUser] });
    await expect(requireTeacher(fake.ctx)).rejects.toThrow(/sign in/i);
  });

  it("does not fall back outside a development deployment", async () => {
    env.NODE_ENV = "production";
    env.ALLOW_DEV_TEACHER = "1";
    const fake = world({ identity: null, users: [localUser] });
    await expect(requireTeacher(fake.ctx)).rejects.toThrow(/sign in/i);
  });

  it("reports a clear code when the dev teacher was never bootstrapped", async () => {
    env.NODE_ENV = "development";
    env.ALLOW_DEV_TEACHER = "1";
    const fake = world({ identity: null, users: [] });
    await expect(requireTeacher(fake.ctx)).rejects.toThrow(/local teacher/i);
  });
});

describe("requireSessionOwner", () => {
  it("returns the session to its owner", async () => {
    const fake = world();
    const { session } = await requireSessionOwner(fake.ctx, SESSION as never);
    expect(session._id).toBe(SESSION);
  });

  it("hides a room owned by another teacher behind NOT_FOUND", async () => {
    const fake = world({ identity: "auth|intruder" });
    await expect(requireSessionOwner(fake.ctx, SESSION as never)).rejects.toThrow(/Classroom not found/);
  });

  it("reports a missing room the same way it reports someone else's", async () => {
    const fake = world();
    await expect(requireSessionOwner(fake.ctx, "sessions:ghost" as never)).rejects.toThrow(
      /Classroom not found/,
    );
  });
});

describe("requireParticipantInSession", () => {
  it("admits a participant of this room", async () => {
    const fake = world();
    const participant = await requireParticipantInSession(fake.ctx, SESSION as never, PARTICIPANT as never);
    expect(participant._id).toBe(PARTICIPANT);
  });

  it("refuses a participant admitted to another room", async () => {
    const fake = world();
    await expect(
      requireParticipantInSession(fake.ctx, "sessions:other" as never, PARTICIPANT as never),
    ).rejects.toThrow(/not admitted/i);
  });

  it("refuses an unknown participant id", async () => {
    const fake = world();
    await expect(
      requireParticipantInSession(fake.ctx, SESSION as never, "participants:ghost" as never),
    ).rejects.toThrow(/not admitted/i);
  });

  it("refuses a participant whose block has not expired", async () => {
    const fake = createFakeConvex({
      identity: { subject: "auth|owner" },
      seed: {
        users: [{ _id: TEACHER, authSubject: "auth|owner", role: "teacher", createdAt: 1 }],
        sessions: [{ _id: SESSION, teacherId: TEACHER, title: "Q", joinCode: "QN47XB", status: "live", latestBoardVersion: 0 }],
        participants: [
          {
            _id: PARTICIPANT,
            sessionId: SESSION,
            anonymousIdHash: "hash-a",
            joinedAt: 1,
            lastSeenAt: 1,
            doubtCount: 0,
            blockedUntil: Date.now() + 60_000,
          },
        ],
      },
    });
    await expect(
      requireParticipantInSession(fake.ctx, SESSION as never, PARTICIPANT as never),
    ).rejects.toThrow(/temporarily unavailable/i);
  });

  it("admits a participant whose block has expired", async () => {
    const fake = createFakeConvex({
      identity: { subject: "auth|owner" },
      seed: {
        users: [{ _id: TEACHER, authSubject: "auth|owner", role: "teacher", createdAt: 1 }],
        sessions: [{ _id: SESSION, teacherId: TEACHER, title: "Q", joinCode: "QN47XB", status: "live", latestBoardVersion: 0 }],
        participants: [
          {
            _id: PARTICIPANT,
            sessionId: SESSION,
            anonymousIdHash: "hash-a",
            joinedAt: 1,
            lastSeenAt: 1,
            doubtCount: 0,
            blockedUntil: Date.now() - 1,
          },
        ],
      },
    });
    const participant = await requireParticipantInSession(fake.ctx, SESSION as never, PARTICIPANT as never);
    expect(participant._id).toBe(PARTICIPANT);
  });
});
