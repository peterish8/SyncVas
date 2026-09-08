/**
 * @phase 7
 * Moderation — MOD-01..04
 *
 * deterministic block; disabled adapter uncertain; no silent drop; duplicates advisory.
 *
 * Non-negotiables: validate public args; ownership checks; indexed queries;
 * internal work via internal functions; never log raw doubt text/secrets.
 */

import { describe, expect, it } from "vitest";

import { submit } from "@/convex/doubts";
import { applyTriage, deterministicScreen } from "@/convex/moderation";
import { createFakeConvex, handlerOf } from "./helpers/fake-convex";

const TEACHER = "users:owner";
const SESSION = "sessions:live";
const PARTICIPANT = "participants:anon-a";

function world() {
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
      participants: [
        { _id: PARTICIPANT, sessionId: SESSION, anonymousIdHash: "hash-a", joinedAt: 1, lastSeenAt: 1, doubtCount: 0 },
      ],
    },
  });
}

const submitDoubt = handlerOf<
  { sessionId: string; participantId: string; text: string },
  { doubtId: string; status: string; reasonCode?: string; duplicateOf?: string }
>(submit);

const triage = handlerOf<
  { doubtId: string; outcome: "accept" | "reject" | "uncertain"; reasonCode?: string; relevanceScore?: number; latencyMs?: number },
  { doubtId: string; status: string } | null
>(applyTriage);

describe("MOD-01 deterministic screening blocks noise without a provider", () => {
  it.each([
    ["", "empty"],
    ["aaaaaaaa", "noise"],
    ["😀😀😀", "noise"],
    ["look at https://spam.example", "blocked_url"],
    ["this is shit", "profanity"],
  ])("rejects %j as %s", (text, reasonCode) => {
    const result = deterministicScreen(text);
    expect(result.outcome).toBe("reject");
    expect(result.reasonCode).toBe(reasonCode);
  });

  it("accepts short genuine questions rather than blocking them for length", () => {
    for (const text of ["why?", "how?", "b^2-4ac", "is a=1 always?"]) {
      expect(deterministicScreen(text).outcome).toBe("accept");
    }
  });

  it("uses one shared policy, so the doubt pipeline and the screen agree", async () => {
    const fake = world();
    const result = await submitDoubt(fake.ctx, {
      sessionId: SESSION,
      participantId: PARTICIPANT,
      text: "read more at https://spam.example",
    });
    expect(result.status).toBe("rejected");
    expect(result.reasonCode).toBe(deterministicScreen("read more at https://spam.example").reasonCode);
  });
});

describe("MOD-02 deterministic rejects never reach a provider", () => {
  it("schedules triage for an accepted doubt only", async () => {
    const fake = world();
    await submitDoubt(fake.ctx, { sessionId: SESSION, participantId: PARTICIPANT, text: "Why is b halved?" });
    expect(fake.scheduled).toHaveLength(1);

    const rejected = world();
    await submitDoubt(rejected.ctx, { sessionId: SESSION, participantId: PARTICIPANT, text: "aaaaaaaa" });
    expect(rejected.scheduled).toHaveLength(0);
  });

  it("passes the doubt id and room scope to triage, and no participant identity", async () => {
    const fake = world();
    const { doubtId } = await submitDoubt(fake.ctx, {
      sessionId: SESSION,
      participantId: PARTICIPANT,
      text: "Where did the 9 come from?",
    });
    const [call] = fake.scheduled;
    expect(call.args).toMatchObject({ doubtId, sessionId: SESSION });
    expect(JSON.stringify(call.args)).not.toContain(PARTICIPANT);
    expect(JSON.stringify(call.args)).not.toContain("hash-a");
  });
});

describe("MOD-03 triage outcomes are applied without silent drops", () => {
  async function accepted() {
    const fake = world();
    const { doubtId } = await submitDoubt(fake.ctx, {
      sessionId: SESSION,
      participantId: PARTICIPANT,
      text: "Why is the discriminant negative here?",
    });
    return { fake, doubtId };
  }

  it("keeps a doubt visible when the provider is disabled", async () => {
    const { fake, doubtId } = await accepted();
    const result = await triage(fake.ctx, { doubtId, outcome: "uncertain", reasonCode: "provider_disabled" });

    expect(result?.status).toBe("accepted");
    expect(fake.rows("doubts")[0].status).toBe("accepted");
    // Still audited: no decision is silent.
    expect(fake.rows("moderationEvents")).toHaveLength(1);
    expect(fake.rows("moderationEvents")[0].reasonCode).toBe("provider_disabled");
  });

  it("keeps a doubt visible when the provider times out or returns junk", async () => {
    for (const reasonCode of ["provider_unavailable", "provider_invalid"]) {
      const { fake, doubtId } = await accepted();
      await triage(fake.ctx, { doubtId, outcome: "reject", reasonCode });
      expect(fake.rows("doubts")[0].status).toBe("accepted");
      expect(fake.rows("moderationEvents")[0].reasonCode).toBe(reasonCode);
    }
  });

  it("moves an ambiguous provider answer to the uncertain queue", async () => {
    const { fake, doubtId } = await accepted();
    const result = await triage(fake.ctx, {
      doubtId,
      outcome: "uncertain",
      reasonCode: "ambiguous",
      relevanceScore: 0.4,
    });

    expect(result?.status).toBe("uncertain");
    expect(fake.rows("doubts")[0].status).toBe("uncertain");
    expect(fake.rows("doubts")[0].relevanceScore).toBe(0.4);
  });

  it("rejects only on a real provider judgement", async () => {
    const { fake, doubtId } = await accepted();
    await triage(fake.ctx, { doubtId, outcome: "reject", reasonCode: "spam" });

    expect(fake.rows("doubts")[0].status).toBe("rejected");
    expect(fake.rows("moderationEvents")[0].decision).toBe("rejected");
  });

  it("does not overwrite a doubt the teacher already resolved", async () => {
    const { fake, doubtId } = await accepted();
    // The teacher answers it while the provider call is still in flight.
    fake.rows("doubts")[0].status = "answered";

    const result = await triage(fake.ctx, { doubtId, outcome: "reject", reasonCode: "spam" });
    expect(result).toBeNull();
    expect(fake.rows("doubts")[0].status).toBe("answered");
    expect(fake.rows("moderationEvents")).toHaveLength(0);
  });

  it("records latency for cost and timeout tuning", async () => {
    const { fake, doubtId } = await accepted();
    await triage(fake.ctx, { doubtId, outcome: "accept", reasonCode: "related_clarification", latencyMs: 812 });
    expect(fake.rows("moderationEvents")[0].latencyMs).toBe(812);
  });
});

describe("MOD-04 duplicates are advisory, never auto-merged", () => {
  it("links a repeat to the earlier doubt and still stores both", async () => {
    const fake = world();
    const first = await submitDoubt(fake.ctx, {
      sessionId: SESSION,
      participantId: PARTICIPANT,
      text: "Why is b halved?",
    });
    const second = await submitDoubt(fake.ctx, {
      sessionId: SESSION,
      participantId: PARTICIPANT,
      text: "  why is B HALVED?  ",
    });

    expect(second.duplicateOf).toBe(first.doubtId);
    expect(second.status).toBe("accepted");
    expect(fake.rows("doubts")).toHaveLength(2);
    expect(fake.rows("doubts")[1].status).not.toBe("merged");
  });

  it("does not mark distinct questions as duplicates", async () => {
    const fake = world();
    await submitDoubt(fake.ctx, { sessionId: SESSION, participantId: PARTICIPANT, text: "Why is b halved?" });
    const other = await submitDoubt(fake.ctx, {
      sessionId: SESSION,
      participantId: PARTICIPANT,
      text: "Where did the 9 come from?",
    });
    expect(other.duplicateOf).toBeUndefined();
  });
});

describe("COST-03 a duplicate reuses the original's verdict", () => {
  const QUESTION = "Why is b halved?";
  const REPEAT = "  why is B HALVED?  ";

  /** Seeds unrelated doubts between the original and the repeat. */
  function worldWithFiller(count: number, original: Record<string, unknown>) {
    const filler = Array.from({ length: count }, (_, index) => ({
      _id: `doubts:filler-${index}`,
      sessionId: SESSION,
      participantId: "participants:filler",
      text: `Unrelated question ${index}`,
      normalizedText: `unrelated question ${index}`,
      status: "accepted",
      voteCount: 0,
      createdAt: 100 + index,
    }));
    return createFakeConvex({
      identity: { subject: "auth|owner" },
      seed: {
        users: [{ _id: TEACHER, authSubject: "auth|owner", role: "teacher", createdAt: 1 }],
        sessions: [
          { _id: SESSION, teacherId: TEACHER, title: "Quadratics", joinCode: "QN47XB", status: "live", latestBoardVersion: 0 },
        ],
        participants: [
          { _id: PARTICIPANT, sessionId: SESSION, anonymousIdHash: "hash-a", joinedAt: 1, lastSeenAt: 1, doubtCount: 0 },
        ],
        doubts: [original, ...filler],
      },
    });
  }

  it("does not call the provider a second time for the same question", async () => {
    const fake = world();
    const first = await submitDoubt(fake.ctx, { sessionId: SESSION, participantId: PARTICIPANT, text: QUESTION });
    await triage(fake.ctx, { doubtId: first.doubtId, outcome: "accept", reasonCode: "on_topic", relevanceScore: 0.9 });
    expect(fake.scheduled).toHaveLength(1);

    const second = await submitDoubt(fake.ctx, { sessionId: SESSION, participantId: PARTICIPANT, text: REPEAT });

    // Still one scheduled call: the repeat inherited the verdict rather than paying for it.
    expect(fake.scheduled).toHaveLength(1);
    expect(second.duplicateOf).toBe(first.doubtId);
    expect(second.status).toBe("accepted");
    expect(fake.rows("doubts")[1].relevanceScore).toBe(0.9);
    // No reasonCode assertion here on purpose: applyTriage only writes one when the
    // verdict changes the status, so a confirming "accept" leaves the original without
    // one. The uncertain case below is where an inherited reasonCode is observable.
  });

  it("inherits an uncertain verdict as uncertain, not as accepted", async () => {
    const fake = world();
    const first = await submitDoubt(fake.ctx, { sessionId: SESSION, participantId: PARTICIPANT, text: QUESTION });
    await triage(fake.ctx, { doubtId: first.doubtId, outcome: "uncertain", reasonCode: "off_topic_maybe" });

    const second = await submitDoubt(fake.ctx, { sessionId: SESSION, participantId: PARTICIPANT, text: REPEAT });
    expect(second.status).toBe("uncertain");
    expect(second.reasonCode).toBe("off_topic_maybe");
    expect(fake.scheduled).toHaveLength(1);
  });

  it("re-enters the queue as accepted when the original was already answered", async () => {
    const fake = worldWithFiller(0, {
      _id: "doubts:answered",
      sessionId: SESSION,
      participantId: "participants:filler",
      text: QUESTION,
      normalizedText: "why is b halved?",
      status: "answered",
      reasonCode: "on_topic",
      voteCount: 3,
      createdAt: 50,
    });

    const repeat = await submitDoubt(fake.ctx, { sessionId: SESSION, participantId: PARTICIPANT, text: REPEAT });
    // The verdict carries over; the lifecycle does not. A fresh asker is still waiting.
    expect(repeat.status).toBe("accepted");
    expect(repeat.duplicateOf).toBe("doubts:answered");
    expect(fake.scheduled).toHaveLength(0);
  });

  it("finds a duplicate further back than the old 100-doubt window", async () => {
    const fake = worldWithFiller(120, {
      _id: "doubts:original",
      sessionId: SESSION,
      participantId: "participants:filler",
      text: QUESTION,
      normalizedText: "why is b halved?",
      status: "accepted",
      reasonCode: "on_topic",
      voteCount: 0,
      createdAt: 1,
    });

    const repeat = await submitDoubt(fake.ctx, { sessionId: SESSION, participantId: PARTICIPANT, text: REPEAT });
    expect(repeat.duplicateOf).toBe("doubts:original");
    expect(fake.scheduled).toHaveLength(0);
  });

  it("does not inherit from a rejected original", async () => {
    const fake = worldWithFiller(0, {
      _id: "doubts:rejected",
      sessionId: SESSION,
      participantId: "participants:filler",
      text: QUESTION,
      normalizedText: "why is b halved?",
      status: "rejected",
      reasonCode: "off_topic",
      voteCount: 0,
      createdAt: 1,
    });

    const repeat = await submitDoubt(fake.ctx, { sessionId: SESSION, participantId: PARTICIPANT, text: REPEAT });
    expect(repeat.duplicateOf).toBeUndefined();
    expect(repeat.status).toBe("accepted");
    // A rejected original carries no reusable verdict, so this one is triaged normally.
    expect(fake.scheduled).toHaveLength(1);
  });

  it("reads a bounded number of rows however busy the room is", async () => {
    const fake = worldWithFiller(120, {
      _id: "doubts:original",
      sessionId: SESSION,
      participantId: "participants:filler",
      text: QUESTION,
      normalizedText: "why is b halved?",
      status: "accepted",
      voteCount: 0,
      createdAt: 1,
    });

    fake.resetReads();
    await submitDoubt(fake.ctx, { sessionId: SESSION, participantId: PARTICIPANT, text: REPEAT });
    // The take(100) scan this replaced read 100 rows on every single submission.
    for (const read of fake.readsOf("doubts")) {
      expect(read.rows).toBeLessThanOrEqual(10);
    }
  });
});
