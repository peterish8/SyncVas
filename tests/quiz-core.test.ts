/**
 * @phase 13
 * Quiz core — QUIZ-01..06.
 *
 * The acceptance that matters is a network check, not a visual one: for a
 * hidden question the student projection must contain no prompt, no options and
 * no answer key.
 */

import { describe, expect, it } from "vitest";

import { joinByCode } from "@/convex/participants";
import {
  createQuestion,
  listForStudent,
  listForTeacher,
  removeQuestion,
  reveal,
  close,
  scoreAnswer,
  submitAnswer,
  updateQuestion,
  leaderboardForRoom,
  SCORING,
} from "@/convex/quiz";
import { createFakeConvex, handlerOf } from "./helpers/fake-convex";

const TEACHER = "users:owner";
const OTHER_TEACHER = "users:intruder";
const SESSION = "sessions:live";
const OTHER_SESSION = "sessions:other";
const PARTICIPANT = "participants:ana";
const OTHER_PARTICIPANT = "participants:ben";
const OUTSIDER = "participants:outsider";

function world(identity = "auth|owner") {
  return createFakeConvex({
    identity: { subject: identity },
    seed: {
      users: [
        { _id: TEACHER, authSubject: "auth|owner", role: "teacher", createdAt: 1 },
        { _id: OTHER_TEACHER, authSubject: "auth|intruder", role: "teacher", createdAt: 1 },
      ],
      sessions: [
        { _id: SESSION, teacherId: TEACHER, title: "Quadratics", joinCode: "QN47XB", status: "live", latestBoardVersion: 0 },
        { _id: OTHER_SESSION, teacherId: OTHER_TEACHER, title: "Other", joinCode: "ZZ11XX", status: "live", latestBoardVersion: 0 },
      ],
      participants: [
        { _id: PARTICIPANT, sessionId: SESSION, anonymousIdHash: "hash-a", displayName: "Ana", joinedAt: 1, lastSeenAt: 1, doubtCount: 0 },
        { _id: OTHER_PARTICIPANT, sessionId: SESSION, anonymousIdHash: "hash-b", displayName: "Ben", joinedAt: 1, lastSeenAt: 1, doubtCount: 0 },
        { _id: OUTSIDER, sessionId: OTHER_SESSION, anonymousIdHash: "hash-z", joinedAt: 1, lastSeenAt: 1, doubtCount: 0 },
      ],
    },
  });
}

type CreateArgs = {
  sessionId: string;
  kind: "mcq" | "truefalse";
  presentation: "board" | "fullscreen";
  prompt: string;
  options: string[];
  correctIndex: number;
  anchorX?: number;
  anchorY?: number;
  windowMs?: number;
};

const create = handlerOf<CreateArgs, { questionId: string }>(createQuestion);
const edit = handlerOf<Record<string, unknown>, unknown>(updateQuestion);
const destroy = handlerOf<{ questionId: string }, unknown>(removeQuestion);
const revealQuestion = handlerOf<{ questionId: string }, { status: string }>(reveal);
const closeQuestion = handlerOf<{ questionId: string }, { status: string }>(close);
const teacherList = handlerOf<{ sessionId: string }, Array<Record<string, unknown>>>(listForTeacher);
const studentList = handlerOf<{ sessionId: string; participantId: string }, Array<Record<string, unknown>>>(listForStudent);
const answer = handlerOf<
  { questionId: string; participantId: string; choiceIndex: number },
  { isCorrect: boolean; points: number }
>(submitAnswer);
const join = handlerOf<
  { code: string; anonymousProof: string; displayName?: string },
  { participantId: string; displayName?: string }
>(joinByCode);
const roomLeaderboard = handlerOf<{ sessionId: string }, Array<Record<string, unknown>>>(leaderboardForRoom);

const MCQ: Omit<CreateArgs, "sessionId"> = {
  kind: "mcq",
  presentation: "board",
  prompt: "Which term completes the square?",
  options: ["(b/2)^2", "b^2", "2b"],
  correctIndex: 0,
};

describe("QUIZ-01 display names are for leaderboards, never for doubts", () => {
  it("stores a screened display name at join", async () => {
    const fake = world();
    const result = await join(fake.ctx, { code: "QN47XB", anonymousProof: "x".repeat(24), displayName: "  Ana   B " });
    expect(result.displayName).toBe("Ana B");
    const stored = fake.rows("participants").find((row) => row._id === result.participantId);
    expect(stored?.displayName).toBe("Ana B");
  });

  it("re-prompts rather than silently substituting a rejected name", async () => {
    const fake = world();
    for (const displayName of ["", "   ", "aaaaaaaa", "visit https://spam.example", "x".repeat(25)]) {
      await expect(
        join(fake.ctx, { code: "QN47XB", anonymousProof: "x".repeat(24), displayName }),
      ).rejects.toThrow(/DISPLAY_NAME_/);
    }
  });

  it("still admits a student who supplies no name", async () => {
    const fake = world();
    const result = await join(fake.ctx, { code: "QN47XB", anonymousProof: "y".repeat(24) });
    expect(result.displayName).toBeUndefined();
    expect(result.participantId).toBeTruthy();
  });
});

describe("QUIZ-02 authoring questions", () => {
  it("creates board-anchored and full-screen questions in one class", async () => {
    const fake = world();
    const board = await create(fake.ctx, { sessionId: SESSION, ...MCQ, anchorX: 320, anchorY: 180 });
    const full = await create(fake.ctx, {
      sessionId: SESSION,
      kind: "truefalse",
      presentation: "fullscreen",
      prompt: "A parabola always has two real roots.",
      options: ["True", "False"],
      correctIndex: 1,
    });

    const rows = await teacherList(fake.ctx, { sessionId: SESSION });
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.order)).toEqual([0, 1]);
    expect(rows.find((row) => row.questionId === board.questionId)?.anchorX).toBe(320);
    expect(rows.find((row) => row.questionId === full.questionId)?.presentation).toBe("fullscreen");
  });

  it("starts every question hidden", async () => {
    const fake = world();
    await create(fake.ctx, { sessionId: SESSION, ...MCQ });
    expect(fake.rows("quizQuestions")[0].status).toBe("hidden");
  });

  it.each([
    ["an empty prompt", { prompt: "  " }, /PROMPT_REQUIRED/],
    ["an overlong prompt", { prompt: "x".repeat(401) }, /PROMPT_TOO_LONG/],
    ["one option", { options: ["only"] }, /INVALID_OPTIONS/],
    ["seven options", { options: ["a", "b", "c", "d", "e", "f", "g"] }, /INVALID_OPTIONS/],
    ["a blank option", { options: ["a", "  "] }, /OPTION_REQUIRED/],
    ["an out-of-range answer key", { correctIndex: 9 }, /INVALID_CORRECT_INDEX/],
    ["a fractional answer key", { correctIndex: 1.5 }, /INVALID_CORRECT_INDEX/],
  ])("refuses %s", async (_label, override, expected) => {
    const fake = world();
    await expect(create(fake.ctx, { sessionId: SESSION, ...MCQ, ...override })).rejects.toThrow(expected);
    expect(fake.rows("quizQuestions")).toHaveLength(0);
  });

  it("requires exactly two options for true/false", async () => {
    const fake = world();
    await expect(
      create(fake.ctx, {
        sessionId: SESSION,
        kind: "truefalse",
        presentation: "fullscreen",
        prompt: "Is it?",
        options: ["True", "False", "Maybe"],
        correctIndex: 0,
      }),
    ).rejects.toThrow(/INVALID_OPTIONS/);
  });

  it("refuses authoring, editing, revealing and deleting to a non-owner", async () => {
    const owner = world();
    const { questionId } = await create(owner.ctx, { sessionId: SESSION, ...MCQ });

    const intruder = world("auth|intruder");
    intruder.rows("quizQuestions").push({
      ...(owner.rows("quizQuestions")[0] as Record<string, unknown>),
      _id: questionId,
      _creationTime: 9,
    } as never);

    await expect(create(intruder.ctx, { sessionId: SESSION, ...MCQ })).rejects.toThrow(/Classroom not found/);
    await expect(edit(intruder.ctx, { questionId, prompt: "Hijacked" })).rejects.toThrow(/Classroom not found/);
    await expect(revealQuestion(intruder.ctx, { questionId })).rejects.toThrow(/Classroom not found/);
    await expect(destroy(intruder.ctx, { questionId })).rejects.toThrow(/Classroom not found/);
  });

  it("refuses to edit a question that is already live", async () => {
    const fake = world();
    const { questionId } = await create(fake.ctx, { sessionId: SESSION, ...MCQ });
    await revealQuestion(fake.ctx, { questionId });
    await expect(edit(fake.ctx, { questionId, prompt: "Changed mid-answer" })).rejects.toThrow(
      /QUESTION_NOT_EDITABLE/,
    );
  });
});

describe("QUIZ-03 a hidden question discloses nothing to students", () => {
  it("omits prompt, options and answer key while hidden", async () => {
    const fake = world();
    await create(fake.ctx, { sessionId: SESSION, ...MCQ });

    const [projected] = await studentList(fake.ctx, { sessionId: SESSION, participantId: PARTICIPANT });
    const keys = Object.keys(projected);

    expect(keys).not.toContain("prompt");
    expect(keys).not.toContain("options");
    expect(keys).not.toContain("correctIndex");
    expect(projected.status).toBe("hidden");

    // The whole payload, as it would cross the wire.
    const wire = JSON.stringify(projected);
    expect(wire).not.toContain("completes the square");
    expect(wire).not.toContain("(b/2)^2");
    expect(wire).not.toContain("b^2");
  });

  it("never includes the answer key at any status", async () => {
    const fake = world();
    const { questionId } = await create(fake.ctx, { sessionId: SESSION, ...MCQ });

    for (const step of ["hidden", "revealed", "closed"] as const) {
      if (step === "revealed") await revealQuestion(fake.ctx, { questionId });
      if (step === "closed") await closeQuestion(fake.ctx, { questionId });

      const rows = await studentList(fake.ctx, { sessionId: SESSION, participantId: PARTICIPANT });
      for (const row of rows) {
        expect(Object.keys(row)).not.toContain("correctIndex");
        expect(JSON.stringify(row)).not.toContain("correctIndex");
      }
    }
  });

  it("gives the teacher the answer key and live counts", async () => {
    const fake = world();
    const { questionId } = await create(fake.ctx, { sessionId: SESSION, ...MCQ });
    await revealQuestion(fake.ctx, { questionId });
    await answer(fake.ctx, { questionId, participantId: PARTICIPANT, choiceIndex: 0 });
    await answer(fake.ctx, { questionId, participantId: OTHER_PARTICIPANT, choiceIndex: 1 });

    const [row] = await teacherList(fake.ctx, { sessionId: SESSION });
    expect(row.correctIndex).toBe(0);
    expect(row.answerCount).toBe(2);
    expect(row.correctCount).toBe(1);
  });

  it("refuses the student list to a participant from another room", async () => {
    const fake = world();
    await create(fake.ctx, { sessionId: SESSION, ...MCQ });
    await expect(studentList(fake.ctx, { sessionId: SESSION, participantId: OUTSIDER })).rejects.toThrow(/FORBIDDEN/);
  });
});

describe("QUIZ-04 revealing makes a question available", () => {
  it("exposes prompt and options only after reveal", async () => {
    const fake = world();
    const { questionId } = await create(fake.ctx, { sessionId: SESSION, ...MCQ });
    await revealQuestion(fake.ctx, { questionId });

    const [projected] = await studentList(fake.ctx, { sessionId: SESSION, participantId: PARTICIPANT });
    expect(projected.prompt).toBe(MCQ.prompt);
    expect(projected.options).toEqual(MCQ.options);
    expect(projected.revealedAt).toBeTypeOf("number");
  });

  it("is idempotent and refuses to reopen a closed question", async () => {
    const fake = world();
    const { questionId } = await create(fake.ctx, { sessionId: SESSION, ...MCQ });

    await revealQuestion(fake.ctx, { questionId });
    const revealedAt = fake.rows("quizQuestions")[0].revealedAt;
    await revealQuestion(fake.ctx, { questionId });
    expect(fake.rows("quizQuestions")[0].revealedAt).toBe(revealedAt);

    await closeQuestion(fake.ctx, { questionId });
    await expect(revealQuestion(fake.ctx, { questionId })).rejects.toThrow(/QUESTION_CLOSED/);
  });

  it("refuses to close a question that was never revealed", async () => {
    const fake = world();
    const { questionId } = await create(fake.ctx, { sessionId: SESSION, ...MCQ });
    await expect(closeQuestion(fake.ctx, { questionId })).rejects.toThrow(/QUESTION_NOT_OPEN/);
  });
});

describe("QUIZ-05 one answer per participant per question", () => {
  async function revealed() {
    const fake = world();
    const { questionId } = await create(fake.ctx, { sessionId: SESSION, ...MCQ });
    await revealQuestion(fake.ctx, { questionId });
    return { fake, questionId };
  }

  it("accepts the first answer and refuses the second", async () => {
    const { fake, questionId } = await revealed();
    await expect(answer(fake.ctx, { questionId, participantId: PARTICIPANT, choiceIndex: 0 })).resolves.toMatchObject({
      isCorrect: true,
    });
    await expect(answer(fake.ctx, { questionId, participantId: PARTICIPANT, choiceIndex: 1 })).rejects.toThrow(
      /ANSWER_ALREADY_CAST/,
    );
    expect(fake.rows("quizAnswers")).toHaveLength(1);
  });

  it("refuses an answer from a participant in another session", async () => {
    const { fake, questionId } = await revealed();
    await expect(answer(fake.ctx, { questionId, participantId: OUTSIDER, choiceIndex: 0 })).rejects.toThrow(
      /FORBIDDEN/,
    );
    expect(fake.rows("quizAnswers")).toHaveLength(0);
  });

  it("refuses an answer to a hidden question without disclosing anything", async () => {
    const fake = world();
    const { questionId } = await create(fake.ctx, { sessionId: SESSION, ...MCQ });
    await expect(
      answer(fake.ctx, { questionId, participantId: PARTICIPANT, choiceIndex: 0 }),
    ).rejects.toThrow(/QUESTION_NOT_OPEN/);
  });

  it("rejects an answer after close rather than recording a zero", async () => {
    const { fake, questionId } = await revealed();
    await closeQuestion(fake.ctx, { questionId });
    await expect(answer(fake.ctx, { questionId, participantId: PARTICIPANT, choiceIndex: 0 })).rejects.toThrow(
      /QUESTION_CLOSED/,
    );
    expect(fake.rows("quizAnswers")).toHaveLength(0);
  });

  it("refuses a choice outside the options", async () => {
    const { fake, questionId } = await revealed();
    for (const choiceIndex of [-1, 3, 1.5]) {
      await expect(answer(fake.ctx, { questionId, participantId: PARTICIPANT, choiceIndex })).rejects.toThrow(
        /INVALID_CHOICE/,
      );
    }
  });
});

describe("QUIZ-06 grading happens server-side", () => {
  it("scores speed-weighted, with a floor and zero for wrong answers", () => {
    const window = SCORING.defaultWindowMs;
    expect(scoreAnswer(true, 0, window)).toBe(1_000);
    expect(scoreAnswer(true, window, window)).toBe(500);
    expect(scoreAnswer(true, window / 2, window)).toBe(750);
    expect(scoreAnswer(false, 0, window)).toBe(0);
    expect(scoreAnswer(false, window, window)).toBe(0);
  });

  it("clamps an answer beyond the window to the floor, never below", () => {
    const window = SCORING.defaultWindowMs;
    expect(scoreAnswer(true, window * 10, window)).toBe(500);
    expect(scoreAnswer(true, -5_000, window)).toBe(1_000);
  });

  it("gives a fast correct answer more than a slow one", async () => {
    const fake = world();
    const { questionId } = await create(fake.ctx, { sessionId: SESSION, ...MCQ, windowMs: 30_000 });
    await revealQuestion(fake.ctx, { questionId });

    const fast = await answer(fake.ctx, { questionId, participantId: PARTICIPANT, choiceIndex: 0 });

    // Push the reveal back so the second answer looks slower.
    const question = fake.rows("quizQuestions")[0];
    question.revealedAt = (question.revealedAt as number) - 20_000;
    const slow = await answer(fake.ctx, { questionId, participantId: OTHER_PARTICIPANT, choiceIndex: 0 });

    expect(fast.points).toBeGreaterThan(slow.points);
    expect(slow.points).toBeGreaterThanOrEqual(500);
  });

  it("scores an incorrect answer zero and records it", async () => {
    const fake = world();
    const { questionId } = await create(fake.ctx, { sessionId: SESSION, ...MCQ });
    await revealQuestion(fake.ctx, { questionId });

    const result = await answer(fake.ctx, { questionId, participantId: PARTICIPANT, choiceIndex: 2 });
    expect(result).toMatchObject({ isCorrect: false, points: 0 });
    expect(fake.rows("quizAnswers")[0].isCorrect).toBe(false);
  });

  it("never returns the answer key to the answering student", async () => {
    const fake = world();
    const { questionId } = await create(fake.ctx, { sessionId: SESSION, ...MCQ });
    await revealQuestion(fake.ctx, { questionId });

    const result = await answer(fake.ctx, { questionId, participantId: PARTICIPANT, choiceIndex: 2 });
    expect(Object.keys(result)).not.toContain("correctIndex");
    expect(JSON.stringify(result)).not.toContain("(b/2)^2");
  });

  it("maintains the score row in the same transaction as the answer", async () => {
    const fake = world();
    const { questionId } = await create(fake.ctx, { sessionId: SESSION, ...MCQ });
    await revealQuestion(fake.ctx, { questionId });
    await answer(fake.ctx, { questionId, participantId: PARTICIPANT, choiceIndex: 0 });

    const [score] = fake.rows("quizScores");
    expect(score.participantId).toBe(PARTICIPANT);
    expect(score.displayName).toBe("Ana");
    expect(score.correctCount).toBe(1);
    expect(score.points).toBeGreaterThan(0);
  });

  it("accumulates across questions instead of replacing the row", async () => {
    const fake = world();
    const first = await create(fake.ctx, { sessionId: SESSION, ...MCQ });
    const second = await create(fake.ctx, { sessionId: SESSION, ...MCQ, prompt: "Second question" });
    await revealQuestion(fake.ctx, { questionId: first.questionId });
    await revealQuestion(fake.ctx, { questionId: second.questionId });

    await answer(fake.ctx, { questionId: first.questionId, participantId: PARTICIPANT, choiceIndex: 0 });
    await answer(fake.ctx, { questionId: second.questionId, participantId: PARTICIPANT, choiceIndex: 1 });

    expect(fake.rows("quizScores")).toHaveLength(1);
    expect(fake.rows("quizScores")[0].correctCount).toBe(1);
  });

  it("names an unnamed participant rather than leaking their id", async () => {
    const fake = world();
    fake.rows("participants").find((row) => row._id === PARTICIPANT)!.displayName = undefined;
    const { questionId } = await create(fake.ctx, { sessionId: SESSION, ...MCQ });
    await revealQuestion(fake.ctx, { questionId });
    await answer(fake.ctx, { questionId, participantId: PARTICIPANT, choiceIndex: 0 });

    expect(fake.rows("quizScores")[0].displayName).toBe("Anonymous");
  });
});

describe("COST-02 the quiz read paths do not scale with the room", () => {
  async function revealedMcq(fake: ReturnType<typeof world>) {
    const { questionId } = await create(fake.ctx, { sessionId: SESSION, ...MCQ });
    await revealQuestion(fake.ctx, { questionId });
    return questionId;
  }

  it("keeps the teacher tallies on the question rather than counting answers", async () => {
    const fake = world();
    const questionId = await revealedMcq(fake);
    await answer(fake.ctx, { questionId, participantId: PARTICIPANT, choiceIndex: 0 });
    await answer(fake.ctx, { questionId, participantId: OTHER_PARTICIPANT, choiceIndex: 2 });

    const question = fake.rows("quizQuestions")[0];
    expect(question.answerCount).toBe(2);
    expect(question.correctCount).toBe(1);

    const [row] = await teacherList(fake.ctx, { sessionId: SESSION });
    expect(row.answerCount).toBe(2);
    expect(row.correctCount).toBe(1);
  });

  it("serves the teacher list without reading a single answer row", async () => {
    const fake = world();
    const questionId = await revealedMcq(fake);
    await answer(fake.ctx, { questionId, participantId: PARTICIPANT, choiceIndex: 0 });
    await answer(fake.ctx, { questionId, participantId: OTHER_PARTICIPANT, choiceIndex: 1 });

    // The values above would also be right if the handler collected the answers, so
    // assert the shape: this is the N+1 that phase 24 removed.
    fake.resetReads();
    await teacherList(fake.ctx, { sessionId: SESSION });
    expect(fake.readsOf("quizAnswers")).toHaveLength(0);
  });

  it("resolves one participant's score row instead of the whole room", async () => {
    const fake = world();
    const first = await revealedMcq(fake);
    await answer(fake.ctx, { questionId: first, participantId: OTHER_PARTICIPANT, choiceIndex: 0 });

    const second = await create(fake.ctx, { sessionId: SESSION, ...MCQ, prompt: "Second question" });
    await revealQuestion(fake.ctx, { questionId: second.questionId });

    fake.resetReads();
    await answer(fake.ctx, { questionId: second.questionId, participantId: PARTICIPANT, choiceIndex: 0 });
    for (const read of fake.readsOf("quizScores")) {
      expect(read.rows).toBeLessThanOrEqual(1);
    }
  });

  it("gives every student the same leaderboard query, with no answer key", async () => {
    const fake = world();
    const questionId = await revealedMcq(fake);
    await answer(fake.ctx, { questionId, participantId: PARTICIPANT, choiceIndex: 0 });
    await answer(fake.ctx, { questionId, participantId: OTHER_PARTICIPANT, choiceIndex: 2 });

    const rows = await roomLeaderboard(fake.ctx, { sessionId: SESSION });
    expect(rows.map((row) => row.displayName)).toEqual(["Ana", "Ben"]);
    expect(rows[0].rank).toBe(1);
    for (const row of rows) {
      expect(row).not.toHaveProperty("correctIndex");
      expect(row).not.toHaveProperty("choiceIndex");
    }
  });

  it("returns nothing once the class is no longer live", async () => {
    const fake = world();
    const questionId = await revealedMcq(fake);
    await answer(fake.ctx, { questionId, participantId: PARTICIPANT, choiceIndex: 0 });

    fake.rows("sessions").find((row) => row._id === SESSION)!.status = "ended";
    await expect(roomLeaderboard(fake.ctx, { sessionId: SESSION })).resolves.toEqual([]);
  });
});
