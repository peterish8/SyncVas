/**
 * Post-class AI notes: read access for the class, regeneration for the owner.
 *
 * Notes are derived from the final board, so they become readable exactly when
 * the board does — after the session has ended. Students read them without an
 * account, which is why the student-facing query is scoped by session status
 * rather than by identity, and returns nothing while a class is still running.
 */

import { v } from "convex/values";
import type { FunctionReference } from "convex/server";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { requireSessionOwner } from "./permissions";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { fail } from "./errors";

/** Folder-nested internal module; see convex/exports.ts for the same pattern. */
const summarizeSession = (internal as unknown as {
  "internal/summarize": { run: FunctionReference<"action", "internal", { sessionId: Id<"sessions"> }, unknown> };
})["internal/summarize"].run;

type SummaryView = {
  status: Doc<"sessionSummaries">["status"] | "pending";
  notesJson: string | null;
  errorCode: string | null;
  provider: string | null;
  completedAt: number | null;
};

function view(row: Doc<"sessionSummaries"> | null): SummaryView {
  if (!row) return { status: "pending", notesJson: null, errorCode: null, provider: null, completedAt: null };
  return {
    status: row.status,
    // Only a ready row carries notes; a failed row must not leak a partial draft.
    notesJson: row.status === "ready" ? row.notesJson ?? null : null,
    errorCode: row.errorCode ?? null,
    provider: row.provider ?? null,
    completedAt: row.completedAt ?? null,
  };
}

async function readSummary(ctx: QueryCtx, sessionId: Id<"sessions">) {
  return await ctx.db
    .query("sessionSummaries")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .unique();
}

/**
 * Student-visible notes. No participant identity is required — anyone holding
 * the session id sees the same ended-class notes the room saw.
 */
export const getForSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status !== "ended") return null;
    return {
      sessionTitle: session.title,
      subject: session.subject ?? null,
      endedAt: session.endedAt ?? null,
      ...view(await readSummary(ctx, args.sessionId)),
    };
  },
});

export const getForTeacher = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const { session } = await requireSessionOwner(ctx, args.sessionId);
    return { sessionTitle: session.title, ...view(await readSummary(ctx, args.sessionId)) };
  },
});

async function scheduleRegenerate(ctx: MutationCtx, session: Doc<"sessions">) {
  if (session.status !== "ended" || !session.latestSnapshotId) {
    fail("FINAL_BOARD_REQUIRED", "End the class before generating notes.");
  }
  const existing = await ctx.db
    .query("sessionSummaries")
    .withIndex("by_session", (q) => q.eq("sessionId", session._id))
    .unique();
  if (existing?.status === "processing") return { status: "processing" as const };

  await ctx.scheduler.runAfter(0, summarizeSession, { sessionId: session._id });
  return { status: "queued" as const };
}

export const regenerate = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const { session } = await requireSessionOwner(ctx, args.sessionId);
    return await scheduleRegenerate(ctx, session);
  },
});

