/**
 * @phase 13-15
 * In-class questions, grading and leaderboards — QUIZ-01..08, LEAD-01..05.
 *
 * Everything here runs on Convex, never Socket.IO: reveal, room lock and
 * scoring happen a handful of times per class, must survive a refresh, and must
 * be authorized. The quiz subsystem adds zero socket events.
 *
 * The security rule that matters most (docs/35): a blurred question on the
 * canvas is not hidden, because the scene is broadcast to every student. The
 * board carries only an anchor card; prompt and options are served by query
 * only once the question is no longer hidden, and `correctIndex` never appears
 * in a student-facing projection at any status.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireParticipantInSession, requireSessionOwner } from "./permissions";
import { fail } from "./errors";

export const SCORING = {
  base: 1_000,
  /** The floor is intentional: reward speed without making a considered answer worthless. */
  speedShare: 0.5,
  defaultWindowMs: 30_000,
} as const;

export const MAX_PROMPT_CHARS = 400;
export const MAX_OPTION_CHARS = 160;
export const MAX_OPTIONS = 6;
export const MIN_WINDOW_MS = 5_000;
export const MAX_WINDOW_MS = 5 * 60_000;

const KIND = v.union(v.literal("mcq"), v.literal("truefalse"));
const PRESENTATION = v.union(v.literal("board"), v.literal("fullscreen"));

/**
 * Speed-weighted score. A correct answer at t=0 scores BASE; at the window edge
 * it scores half. An incorrect answer scores zero regardless of speed.
 */
export function scoreAnswer(isCorrect: boolean, elapsedMs: number, windowMs: number): number {
  if (!isCorrect) return 0;
  const window = windowMs > 0 ? windowMs : SCORING.defaultWindowMs;
  const elapsed = Math.min(Math.max(elapsedMs, 0), window);
  return Math.round(SCORING.base * (1 - SCORING.speedShare * (elapsed / window)));
}

function validateQuestionShape(kind: "mcq" | "truefalse", prompt: string, options: string[], correctIndex: number) {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) fail("PROMPT_REQUIRED", "Enter the question.");
  if (trimmedPrompt.length > MAX_PROMPT_CHARS) fail("PROMPT_TOO_LONG", "Shorten the question.");

  const trimmedOptions = options.map((option) => option.trim());
  if (trimmedOptions.some((option) => !option)) fail("OPTION_REQUIRED", "Every option needs text.");
  if (trimmedOptions.some((option) => option.length > MAX_OPTION_CHARS)) {
    fail("OPTION_TOO_LONG", "Shorten the options.");
  }
  if (kind === "truefalse") {
    if (trimmedOptions.length !== 2) fail("INVALID_OPTIONS", "A true/false question needs exactly two options.");
  } else if (trimmedOptions.length < 2 || trimmedOptions.length > MAX_OPTIONS) {
    fail("INVALID_OPTIONS", "An MCQ needs between two and six options.");
  }
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= trimmedOptions.length) {
    fail("INVALID_CORRECT_INDEX", "Mark which option is correct.");
  }
  return { prompt: trimmedPrompt, options: trimmedOptions };
}

function normalizeWindowMs(windowMs: number | undefined): number {
  if (windowMs === undefined) return SCORING.defaultWindowMs;
  if (!Number.isInteger(windowMs) || windowMs < MIN_WINDOW_MS || windowMs > MAX_WINDOW_MS) {
    fail("INVALID_WINDOW", `Answer window must be between ${MIN_WINDOW_MS} and ${MAX_WINDOW_MS} milliseconds.`);
  }
  return windowMs;
}

async function nextOrder(ctx: MutationCtx, sessionId: Id<"sessions">): Promise<number> {
  const existing = await ctx.db
    .query("quizQuestions")
    .withIndex("by_session_order", (q) => q.eq("sessionId", sessionId))
    .order("desc")
    .take(1);
  return existing.length === 0 ? 0 : (existing[0].order ?? 0) + 1;
}

async function ownedQuestion(
  ctx: QueryCtx | MutationCtx,
  questionId: Id<"quizQuestions">,
): Promise<Doc<"quizQuestions">> {
  const question = await ctx.db.get(questionId);
  if (!question) fail("NOT_FOUND", "Question not found.");
  return question;
}

/**
 * The student projection. `correctIndex` is absent from every branch, and a
 * hidden question yields no prompt and no options — so neither can leak through
 * a later careless edit.
 */
function studentProjection(question: Doc<"quizQuestions">) {
  if (question.status === "hidden") {
    return {
      questionId: question._id,
      order: question.order,
      status: question.status,
      presentation: question.presentation,
    };
  }
  return {
    questionId: question._id,
    order: question.order,
    status: question.status,
    presentation: question.presentation,
    kind: question.kind,
    prompt: question.prompt,
    options: question.options,
    revealedAt: question.revealedAt,
    windowMs: question.windowMs ?? SCORING.defaultWindowMs,
  };
}

/* ---------------------------------------------------------------- teacher -- */

async function insertQuestion(
  ctx: MutationCtx,
  sessionId: Id<"sessions">,
  args: {
    kind: "mcq" | "truefalse";
    presentation: "board" | "fullscreen";
    prompt: string;
    options: string[];
    correctIndex: number;
    anchorX?: number;
    anchorY?: number;
    windowMs?: number;
  },
) {
  const { prompt, options } = validateQuestionShape(args.kind, args.prompt, args.options, args.correctIndex);
  const questionId = await ctx.db.insert("quizQuestions", {
    sessionId,
    order: await nextOrder(ctx, sessionId),
    kind: args.kind,
    presentation: args.presentation,
    prompt,
    options,
    correctIndex: args.correctIndex,
    status: "hidden",
    anchorX: args.anchorX,
    anchorY: args.anchorY,
    windowMs: normalizeWindowMs(args.windowMs),
  });
  return { questionId };
}

const CREATE_ARGS = {
  sessionId: v.id("sessions"),
  kind: KIND,
  presentation: PRESENTATION,
  prompt: v.string(),
  options: v.array(v.string()),
  correctIndex: v.number(),
  anchorX: v.optional(v.number()),
  anchorY: v.optional(v.number()),
  windowMs: v.optional(v.number()),
} as const;

export const createQuestion = mutation({
  args: CREATE_ARGS,
  handler: async (ctx, args) => {
    await requireSessionOwner(ctx, args.sessionId);
    return await insertQuestion(ctx, args.sessionId, args);
  },
});

export const updateQuestion = mutation({
  args: {
    questionId: v.id("quizQuestions"),
    prompt: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
    correctIndex: v.optional(v.number()),
    anchorX: v.optional(v.number()),
    anchorY: v.optional(v.number()),
    windowMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const question = await ownedQuestion(ctx, args.questionId);
    await requireSessionOwner(ctx, question.sessionId);
    // Editing a live question would move the target under students mid-answer.
    if (question.status !== "hidden") fail("QUESTION_NOT_EDITABLE", "Close the question before editing it.");

    const { prompt, options } = validateQuestionShape(
      question.kind,
      args.prompt ?? question.prompt,
      args.options ?? question.options,
      args.correctIndex ?? question.correctIndex,
    );
    await ctx.db.patch(question._id, {
      prompt,
      options,
      correctIndex: args.correctIndex ?? question.correctIndex,
      anchorX: args.anchorX ?? question.anchorX,
      anchorY: args.anchorY ?? question.anchorY,
      windowMs: normalizeWindowMs(args.windowMs ?? question.windowMs),
    });
    return { questionId: question._id };
  },
});

export const removeQuestion = mutation({
  args: { questionId: v.id("quizQuestions") },
  handler: async (ctx, args) => {
    const question = await ownedQuestion(ctx, args.questionId);
    await requireSessionOwner(ctx, question.sessionId);
    await ctx.db.delete(question._id);
    return { questionId: args.questionId };
  },
});

async function setStatus(
  ctx: MutationCtx,
  questionId: Id<"quizQuestions">,
  next: "revealed" | "closed",
) {
  const question = await ctx.db.get(questionId);
  if (!question) fail("NOT_FOUND", "Question not found.");
  if (next === "revealed") {
    if (question.status === "closed") fail("QUESTION_CLOSED", "That question is already closed.");
    if (question.status === "revealed") return { questionId: question._id, status: "revealed" as const };
    await ctx.db.patch(question._id, { status: "revealed", revealedAt: Date.now() });
    return { questionId: question._id, status: "revealed" as const };
  }
  if (question.status !== "revealed") fail("QUESTION_NOT_OPEN", "Reveal the question before closing it.");
  await ctx.db.patch(question._id, { status: "closed", closedAt: Date.now() });
  return { questionId: question._id, status: "closed" as const };
}

export const reveal = mutation({
  args: { questionId: v.id("quizQuestions") },
  handler: async (ctx, args) => {
    const question = await ownedQuestion(ctx, args.questionId);
    await requireSessionOwner(ctx, question.sessionId);
    return await setStatus(ctx, args.questionId, "revealed");
  },
});

export const close = mutation({
  args: { questionId: v.id("quizQuestions") },
  handler: async (ctx, args) => {
    const question = await ownedQuestion(ctx, args.questionId);
    await requireSessionOwner(ctx, question.sessionId);
    return await setStatus(ctx, args.questionId, "closed");
  },
});

/**
 * Reads the tallies denormalized onto the question by `submitAnswer`. Collecting the
 * answers per question made this reactive query O(questions x answers) on every single
 * submission, which is the shape phase 24 removed.
 */
async function teacherQuestions(ctx: QueryCtx, sessionId: Id<"sessions">) {
  const questions = await ctx.db
    .query("quizQuestions")
    .withIndex("by_session_order", (q) => q.eq("sessionId", sessionId))
    .collect();

  return questions.map((question) => ({
    questionId: question._id,
    order: question.order,
    kind: question.kind,
    presentation: question.presentation,
    prompt: question.prompt,
    options: question.options,
    correctIndex: question.correctIndex,
    status: question.status,
    anchorX: question.anchorX,
    anchorY: question.anchorY,
    windowMs: question.windowMs ?? SCORING.defaultWindowMs,
    revealedAt: question.revealedAt,
    closedAt: question.closedAt,
    answerCount: question.answerCount ?? 0,
    correctCount: question.correctCount ?? 0,
  }));
}

export const listForTeacher = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    await requireSessionOwner(ctx, args.sessionId);
    return await teacherQuestions(ctx, args.sessionId);
  },
});

async function setRoomModeForOwner(
  ctx: MutationCtx,
  sessionId: Id<"sessions">,
  mode: "board" | "quiz-locked",
) {
  const { session } = await requireSessionOwner(ctx, sessionId);
  if (session.status !== "live") fail("SESSION_NOT_LIVE", "Quiz mode can only change during a live class.");
  await ctx.db.patch(session._id, { roomMode: mode });
  return { sessionId: session._id, roomMode: mode };
}

export const setRoomMode = mutation({
  args: { sessionId: v.id("sessions"), mode: v.union(v.literal("board"), v.literal("quiz-locked")) },
  handler: async (ctx, args) => setRoomModeForOwner(ctx, args.sessionId, args.mode),
});

type LeaderboardRow = {
  participantId: Id<"participants">;
  displayName: string;
  points: number;
  correctCount: number;
  totalMs: number;
  rank: number;
};

async function leaderboardForSession(ctx: QueryCtx, sessionId: Id<"sessions">): Promise<LeaderboardRow[]> {
  const rows = await ctx.db
    .query("quizScores")
    .withIndex("by_session_points", (q) => q.eq("sessionId", sessionId))
    .order("desc")
    .collect();
  return rows
    .sort((a, b) => b.points - a.points || a.totalMs - b.totalMs || a._creationTime - b._creationTime)
    .map((row, index) => ({
      participantId: row.participantId,
      displayName: row.displayName,
      points: row.points,
      correctCount: row.correctCount,
      totalMs: row.totalMs,
      rank: index + 1,
    }));
}

export const leaderboard = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    await requireSessionOwner(ctx, args.sessionId);
    return await leaderboardForSession(ctx, args.sessionId);
  },
});

/**
 * The student-facing leaderboard.
 *
 * Deliberately takes only `sessionId`. The `myStanding(sessionId, participantId)` this
 * replaced produced a distinct query-and-args pair per student, so Convex recomputed the
 * whole leaderboard once per student on every answer — O(students^2) across a class.
 * Identical args across the room share one computation, and the client finds its own row.
 *
 * Authorization: gated on the room existing and being live, not on participant
 * membership — the same posture as `doubts.listOpen`. Names and scores on a leaderboard
 * are public to the room by design. Doubt anonymity is unaffected: the doubts queue still
 * carries no display name.
 */
export const leaderboardForRoom = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status !== "live") return [];
    return await leaderboardForSession(ctx, args.sessionId);
  },
});

/* ---------------------------------------------------------------- student -- */

// One shared implementation with doubts.ts — see permissions.requireParticipantInSession.
const participantInSession = requireParticipantInSession;

export const listForStudent = query({
  args: { sessionId: v.id("sessions"), participantId: v.id("participants") },
  handler: async (ctx, args) => {
    await participantInSession(ctx, args.sessionId, args.participantId);
    const questions = await ctx.db
      .query("quizQuestions")
      .withIndex("by_session_order", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    return questions.map(studentProjection);
  },
});

export const submitAnswer = mutation({
  args: {
    questionId: v.id("quizQuestions"),
    participantId: v.id("participants"),
    choiceIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const question = await ctx.db.get(args.questionId);
    // Say nothing about a question the student may not answer.
    if (!question) fail("QUESTION_NOT_OPEN", "That question is not open.");
    const participant = await participantInSession(ctx, question.sessionId, args.participantId);

    if (question.status === "hidden") fail("QUESTION_NOT_OPEN", "That question is not open.");
    if (question.status === "closed") fail("QUESTION_CLOSED", "That question has closed.");

    if (!Number.isInteger(args.choiceIndex) || args.choiceIndex < 0 || args.choiceIndex >= question.options.length) {
      fail("INVALID_CHOICE", "Pick one of the options.");
    }

    const existing = await ctx.db
      .query("quizAnswers")
      .withIndex("by_question_participant", (q) =>
        q.eq("questionId", question._id).eq("participantId", participant._id),
      )
      .unique();
    if (existing) fail("ANSWER_ALREADY_CAST", "You have already answered this question.");

    // Grading happens here, server-side. The client never sees correctIndex.
    const now = Date.now();
    const windowMs = normalizeWindowMs(question.windowMs);
    const elapsedMs = Math.max(0, now - (question.revealedAt ?? now));
    const isCorrect = args.choiceIndex === question.correctIndex;
    const points = scoreAnswer(isCorrect, elapsedMs, windowMs);

    await ctx.db.insert("quizAnswers", {
      sessionId: question.sessionId,
      questionId: question._id,
      participantId: participant._id,
      choiceIndex: args.choiceIndex,
      isCorrect,
      answeredAt: now,
      elapsedMs: Math.min(elapsedMs, windowMs),
      points,
    });

    // Tallies for the teacher view, denormalized in the same transaction as the answer
    // so listForTeacher never has to collect answers to count them.
    await ctx.db.patch(question._id, {
      answerCount: (question.answerCount ?? 0) + 1,
      correctCount: (question.correctCount ?? 0) + (isCorrect ? 1 : 0),
    });

    // Denormalized in the same transaction so the two cannot drift, and so the
    // leaderboard is an indexed read rather than a scan over every answer.
    const score = await ctx.db
      .query("quizScores")
      .withIndex("by_session_participant", (q) =>
        q.eq("sessionId", question.sessionId).eq("participantId", participant._id),
      )
      .unique();

    if (score) {
      await ctx.db.patch(score._id, {
        points: score.points + points,
        correctCount: score.correctCount + (isCorrect ? 1 : 0),
        totalMs: score.totalMs + Math.min(elapsedMs, windowMs),
        ...(participant.displayName ? { displayName: participant.displayName } : {}),
      });
    } else {
      await ctx.db.insert("quizScores", {
        sessionId: question.sessionId,
        participantId: participant._id,
        displayName: participant.displayName ?? "Anonymous",
        points,
        correctCount: isCorrect ? 1 : 0,
        totalMs: Math.min(elapsedMs, windowMs),
      });
    }

    // The student learns their own result; still no answer key for the question.
    return { questionId: question._id, isCorrect, points };
  },
});
