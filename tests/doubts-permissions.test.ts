/**
 * @phase 5
 * Doubts permissions — DOUBT-01..05
 *
 * Anonymous queue; rate limit without AI; one vote per participant;
 * teacher-only resolve.
 *
 * Non-negotiables: validate public args; ownership checks; indexed queries;
 * internal work via internal functions; never log raw doubt text/secrets.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { listOpen, listTeacherQueue, resolve, submit, vote } from "@/convex/doubts";
import { DOUBT_MAX_CHARS, DOUBT_RATE_LIMIT_MAX } from "@/shared/constants/limits";
import { createFakeConvex, handlerOf } from "./helpers/fake-convex";

const TEACHER = "users:owner";
const OTHER_TEACHER = "users:intruder";
const SESSION = "sessions:live";
const PARTICIPANT = "participants:anon-a";
const OTHER_PARTICIPANT = "participants:anon-b";

function world(overrides?: { sessionStatus?: string; identity?: string }) {
  return createFakeConvex({
    identity: { subject: overrides?.identity ?? "auth|owner" },
    seed: {
      users: [
        { _id: TEACHER, authSubject: "auth|owner", role: "teacher", createdAt: 1 },
        { _id: OTHER_TEACHER, authSubject: "auth|intruder", role: "teacher", createdAt: 1 },
      ],
      sessions: [
        {
          _id: SESSION,
          teacherId: TEACHER,
          title: "Quadratics",
          joinCode: "QN47XB",
          status: overrides?.sessionStatus ?? "live",
          latestBoardVersion: 0,
        },
      ],
      participants: [
        { _id: PARTICIPANT, sessionId: SESSION, anonymousIdHash: "hash-a", joinedAt: 1, lastSeenAt: 1, doubtCount: 0 },
        { _id: OTHER_PARTICIPANT, sessionId: SESSION, anonymousIdHash: "hash-b", joinedAt: 1, lastSeenAt: 1, doubtCount: 0 },
      ],
    },
  });
}

const submitDoubt = handlerOf<{ sessionId: string; participantId: string; text: string }, { doubtId: string; status: string; duplicateOf?: string }>(submit);
const castVote = handlerOf<{ doubtId: string; participantId: string }, { voteCount: number }>(vote);
const resolveDoubt = handlerOf<{ doubtId: string; action: "answered" | "dismissed" }, unknown>(resolve);
const teacherQueue = handlerOf<{ sessionId: string }, Array<Record<string, unknown>>>(listTeacherQueue);

describe("DOUBT-01 anonymous submission", () => {
  let fake: ReturnType<typeof world>;
  beforeEach(() => {
    fake = world();
  });

  it("accepts a doubt and stores it against the room", async () => {
    const result = await submitDoubt(fake.ctx, {
      sessionId: SESSION,
      participantId: PARTICIPANT,
      text: "Where did the 9 come from?",
    });
    expect(result.status).toBe("accepted");
    expect(fake.rows("doubts")).toHaveLength(1);
  });

  it("never exposes participant identity through the teacher queue", async () => {
    await submitDoubt(fake.ctx, { sessionId: SESSION, participantId: PARTICIPANT, text: "Why is b halved?" });
    const queue = await teacherQueue(fake.ctx, { sessionId: SESSION });

    expect(queue).toHaveLength(1);
    for (const row of queue) {
      const keys = Object.keys(row);
      expect(keys).not.toContain("participantId");
      expect(keys).not.toContain("anonymousIdHash");
      expect(JSON.stringify(row)).not.toContain(PARTICIPANT);
      expect(JSON.stringify(row)).not.toContain("hash-a");
    }
  });

  it("rejects a doubt for a room that is not live", async () => {
    const ended = world({ sessionStatus: "ended" });
    await expect(
      submitDoubt(ended.ctx, { sessionId: SESSION, participantId: PARTICIPANT, text: "Too late?" }),
    ).rejects.toThrow("SESSION_NOT_LIVE");
  });

  it("rejects a participant that belongs to another room", async () => {
    const fakeWorld = world();
    fakeWorld.rows("participants").push({
      _id: "participants:elsewhere",
      _creationTime: 9,
      sessionId: "sessions:other",
      anonymousIdHash: "hash-x",
      joinedAt: 1,
      lastSeenAt: 1,
      doubtCount: 0,
    });
    await expect(
      submitDoubt(fakeWorld.ctx, { sessionId: SESSION, participantId: "participants:elsewhere", text: "Cross room" }),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("enforces the 220-character limit", async () => {
    await expect(
      submitDoubt(fake.ctx, {
        sessionId: SESSION,
        participantId: PARTICIPANT,
        text: "x".repeat(DOUBT_MAX_CHARS + 1),
      }),
    ).rejects.toThrow("DOUBT_TOO_LONG");
  });
});

describe("DOUBT-02 rate limiting without AI", () => {
  it("blocks the sixth doubt inside the window and never calls an adapter", async () => {
    const fake = world();
    const moderationCalls: string[] = [];
    const originalFetch = globalThis.fetch;
    // Any adapter call would go out over fetch; there must be none.
    globalThis.fetch = (async (input: unknown) => {
      moderationCalls.push(String(input));
      throw new Error("no network expected in the deterministic path");
    }) as typeof fetch;

    try {
      for (let i = 0; i < DOUBT_RATE_LIMIT_MAX; i += 1) {
        await submitDoubt(fake.ctx, {
          sessionId: SESSION,
          participantId: PARTICIPANT,
          text: `Question number ${i}`,
        });
      }
      await expect(
        submitDoubt(fake.ctx, { sessionId: SESSION, participantId: PARTICIPANT, text: "One too many" }),
      ).rejects.toThrow("DOUBT_RATE_LIMITED");
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(moderationCalls).toEqual([]);
    expect(fake.rows("doubts")).toHaveLength(DOUBT_RATE_LIMIT_MAX);
  });

  it("rate limits per participant, not per room", async () => {
    const fake = world();
    for (let i = 0; i < DOUBT_RATE_LIMIT_MAX; i += 1) {
      await submitDoubt(fake.ctx, { sessionId: SESSION, participantId: PARTICIPANT, text: `Q${i}` });
    }
    await expect(
      submitDoubt(fake.ctx, { sessionId: SESSION, participantId: OTHER_PARTICIPANT, text: "Different student" }),
    ).resolves.toMatchObject({ status: "accepted" });
  });
});

describe("DOUBT-04 one vote per participant", () => {
  it("counts the first vote and refuses the second from the same participant", async () => {
    const fake = world();
    const { doubtId } = await submitDoubt(fake.ctx, {
      sessionId: SESSION,
      participantId: PARTICIPANT,
      text: "Can a be other than 1?",
    });

    await expect(castVote(fake.ctx, { doubtId, participantId: OTHER_PARTICIPANT })).resolves.toEqual({ voteCount: 1 });
    await expect(castVote(fake.ctx, { doubtId, participantId: OTHER_PARTICIPANT })).rejects.toThrow("VOTE_ALREADY_CAST");
    expect(fake.rows("doubtVotes")).toHaveLength(1);
  });

  it("refuses a vote from a participant in another room", async () => {
    const fake = world();
    const { doubtId } = await submitDoubt(fake.ctx, { sessionId: SESSION, participantId: PARTICIPANT, text: "Scoped?" });
    fake.rows("participants").push({
      _id: "participants:outsider",
      _creationTime: 9,
      sessionId: "sessions:other",
      anonymousIdHash: "hash-z",
      joinedAt: 1,
      lastSeenAt: 1,
      doubtCount: 0,
    });
    await expect(
      castVote(fake.ctx, { doubtId, participantId: "participants:outsider" }),
    ).rejects.toThrow("FORBIDDEN");
  });
});

describe("DOUBT-03 teacher-only resolution", () => {
  it("lets the owning teacher mark a doubt answered", async () => {
    const fake = world();
    const { doubtId } = await submitDoubt(fake.ctx, { sessionId: SESSION, participantId: PARTICIPANT, text: "Resolve me" });
    await expect(resolveDoubt(fake.ctx, { doubtId, action: "answered" })).resolves.toMatchObject({ status: "answered" });
    expect(fake.rows("doubts")[0].status).toBe("answered");
  });

  it("refuses resolution by a teacher who does not own the room", async () => {
    const owner = world();
    const { doubtId } = await submitDoubt(owner.ctx, { sessionId: SESSION, participantId: PARTICIPANT, text: "Not yours" });

    const intruder = createFakeConvex({
      identity: { subject: "auth|intruder" },
      seed: {
        users: [{ _id: OTHER_TEACHER, authSubject: "auth|intruder", role: "teacher", createdAt: 1 }],
        sessions: [{ _id: SESSION, teacherId: TEACHER, title: "Quadratics", joinCode: "QN47XB", status: "live", latestBoardVersion: 0 }],
        doubts: [{ _id: doubtId, sessionId: SESSION, participantId: PARTICIPANT, text: "Not yours", normalizedText: "not yours", status: "accepted", voteCount: 0, createdAt: 5 }],
      },
    });
    await expect(resolveDoubt(intruder.ctx, { doubtId, action: "dismissed" })).rejects.toThrow("Classroom not found");
  });

  it("refuses the teacher queue to a non-owner", async () => {
    const intruder = createFakeConvex({
      identity: { subject: "auth|intruder" },
      seed: {
        users: [{ _id: OTHER_TEACHER, authSubject: "auth|intruder", role: "teacher", createdAt: 1 }],
        sessions: [{ _id: SESSION, teacherId: TEACHER, title: "Quadratics", joinCode: "QN47XB", status: "live", latestBoardVersion: 0 }],
      },
    });
    await expect(teacherQueue(intruder.ctx, { sessionId: SESSION })).rejects.toThrow("Classroom not found");
  });
});

/**
 * The student-facing list used to take only a sessionId, so anyone holding one
 * could read every question in a live room. Doubt anonymity is the product's
 * central privacy promise, so admission is now proven on the read too.
 */
describe("DOUBT-06 student list admission", () => {
  const openList = handlerOf<
    { sessionId: string; participantId: string },
    Array<Record<string, unknown>>
  >(listOpen);

  it("returns the open queue to an admitted participant", async () => {
    const fake = world();
    await submitDoubt(fake.ctx, { sessionId: SESSION, participantId: PARTICIPANT, text: "Why is b halved?" });

    const rows = await openList(fake.ctx, { sessionId: SESSION, participantId: PARTICIPANT });
    expect(rows).toHaveLength(1);
  });

  it("refuses a participant admitted to a different room", async () => {
    const fake = createFakeConvex({
      identity: { subject: "auth|owner" },
      seed: {
        users: [{ _id: TEACHER, authSubject: "auth|owner", role: "teacher", createdAt: 1 }],
        sessions: [
          { _id: SESSION, teacherId: TEACHER, title: "Quadratics", joinCode: "QN47XB", status: "live", latestBoardVersion: 0 },
          { _id: "sessions:other", teacherId: TEACHER, title: "Other", joinCode: "ZZ99YY", status: "live", latestBoardVersion: 0 },
        ],
        participants: [
          { _id: "participants:outsider", sessionId: "sessions:other", anonymousIdHash: "hash-x", joinedAt: 1, lastSeenAt: 1, doubtCount: 0 },
        ],
      },
    });

    await expect(
      openList(fake.ctx, { sessionId: SESSION, participantId: "participants:outsider" }),
    ).rejects.toThrow("not admitted");
  });

  it("refuses a blocked participant", async () => {
    const fake = createFakeConvex({
      identity: { subject: "auth|owner" },
      seed: {
        users: [{ _id: TEACHER, authSubject: "auth|owner", role: "teacher", createdAt: 1 }],
        sessions: [{ _id: SESSION, teacherId: TEACHER, title: "Quadratics", joinCode: "QN47XB", status: "live", latestBoardVersion: 0 }],
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
      openList(fake.ctx, { sessionId: SESSION, participantId: PARTICIPANT }),
    ).rejects.toThrow(/temporarily unavailable/i);
  });
});
