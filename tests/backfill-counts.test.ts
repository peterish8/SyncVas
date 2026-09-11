/**
 * @phase 24 (COST-02)
 * Counter backfill for rows written before the counters existed.
 *
 * The read sites treat an absent counter as 0, which is right for a new room and wrong
 * for one that already has participants or answers. These tests pin the two properties
 * the backfill is relied on for: it converges on the child rows, and re-running it
 * changes nothing.
 */

import { describe, expect, it } from "vitest";

import { quizQuestions, sessions } from "@/convex/internal/backfillCounts";
import { createFakeConvex, handlerOf } from "./helpers/fake-convex";

type BackfillArgs = { cursor?: string; batchSize?: number };
type BackfillResult = { scanned: number; patched: number; isDone: boolean; cursor: string | null };

const backfillSessions = handlerOf<BackfillArgs, BackfillResult>(sessions);
const backfillQuestions = handlerOf<BackfillArgs, BackfillResult>(quizQuestions);

/** Walk every page the way the runbook does, and report what each pass patched. */
async function runToCompletion(
  handler: (ctx: unknown, args: BackfillArgs) => Promise<BackfillResult>,
  ctx: unknown,
  batchSize = 2,
): Promise<{ patched: number; passes: number }> {
  let cursor: string | undefined;
  let patched = 0;
  let passes = 0;
  for (;;) {
    const result: BackfillResult = await handler(ctx, { cursor, batchSize });
    patched += result.patched;
    passes += 1;
    if (result.isDone) return { patched, passes };
    cursor = result.cursor ?? undefined;
    if (passes > 50) throw new Error("backfill did not terminate");
  }
}

function legacyWorld() {
  return createFakeConvex({
    seed: {
      // No studentCount and no answerCount: rows as they exist before phase 24.
      sessions: [
        { _id: "sessions:a", teacherId: "users:t", title: "A", joinCode: "AAA111", status: "ended", latestBoardVersion: 3 },
        { _id: "sessions:b", teacherId: "users:t", title: "B", joinCode: "BBB222", status: "live", latestBoardVersion: 1 },
        { _id: "sessions:c", teacherId: "users:t", title: "C", joinCode: "CCC333", status: "draft", latestBoardVersion: 0 },
      ],
      participants: [
        { _id: "participants:1", sessionId: "sessions:a", anonymousIdHash: "h1", joinedAt: 1, lastSeenAt: 1, doubtCount: 0 },
        { _id: "participants:2", sessionId: "sessions:a", anonymousIdHash: "h2", joinedAt: 1, lastSeenAt: 1, doubtCount: 0 },
        { _id: "participants:3", sessionId: "sessions:b", anonymousIdHash: "h3", joinedAt: 1, lastSeenAt: 1, doubtCount: 0 },
      ],
      quizQuestions: [
        { _id: "quizQuestions:1", sessionId: "sessions:a", order: 0, kind: "mcq", presentation: "board", prompt: "P", options: ["x", "y"], correctIndex: 0, status: "closed" },
        { _id: "quizQuestions:2", sessionId: "sessions:a", order: 1, kind: "mcq", presentation: "board", prompt: "Q", options: ["x", "y"], correctIndex: 1, status: "closed" },
      ],
      quizAnswers: [
        { _id: "quizAnswers:1", sessionId: "sessions:a", questionId: "quizQuestions:1", participantId: "participants:1", choiceIndex: 0, isCorrect: true, answeredAt: 1, elapsedMs: 10, points: 999 },
        { _id: "quizAnswers:2", sessionId: "sessions:a", questionId: "quizQuestions:1", participantId: "participants:2", choiceIndex: 1, isCorrect: false, answeredAt: 2, elapsedMs: 20, points: 0 },
      ],
    },
  });
}

describe("backfillCounts", () => {
  it("sets sessions.studentCount from the participant rows", async () => {
    const fake = legacyWorld();
    const { patched } = await runToCompletion(backfillSessions, fake.ctx);

    expect(patched).toBe(3);
    const byId = new Map(fake.rows("sessions").map((row) => [row._id, row.studentCount]));
    expect(byId.get("sessions:a")).toBe(2);
    expect(byId.get("sessions:b")).toBe(1);
    expect(byId.get("sessions:c")).toBe(0);
  });

  it("sets the quiz tallies from the answer rows", async () => {
    const fake = legacyWorld();
    await runToCompletion(backfillQuestions, fake.ctx);

    const first = fake.rows("quizQuestions").find((row) => row._id === "quizQuestions:1");
    const second = fake.rows("quizQuestions").find((row) => row._id === "quizQuestions:2");
    expect(first).toMatchObject({ answerCount: 2, correctCount: 1 });
    expect(second).toMatchObject({ answerCount: 0, correctCount: 0 });
  });

  it("is idempotent — a second run patches nothing", async () => {
    const fake = legacyWorld();
    await runToCompletion(backfillSessions, fake.ctx);
    await runToCompletion(backfillQuestions, fake.ctx);

    const second = await runToCompletion(backfillSessions, fake.ctx);
    const secondQuestions = await runToCompletion(backfillQuestions, fake.ctx);
    expect(second.patched).toBe(0);
    expect(secondQuestions.patched).toBe(0);
  });

  it("walks in bounded batches rather than one pass", async () => {
    const fake = legacyWorld();
    const { passes } = await runToCompletion(backfillSessions, fake.ctx, 1);
    // Three sessions at one per page: the walk must resume by cursor, not restart.
    expect(passes).toBeGreaterThan(1);
    expect(fake.rows("sessions").every((row) => typeof row.studentCount === "number")).toBe(true);
  });
});
