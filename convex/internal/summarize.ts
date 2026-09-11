/**
 * Post-class AI notes generation.
 *
 * Runs only from the internal scheduler after a session reaches "ended". This
 * is deliberately downstream of finalization: the saved board and exports must
 * remain available whether or not AI is configured or succeeds, so every
 * failure path here writes a status row instead of throwing.
 *
 * Never logs board text, doubt text, or provider credentials.
 */

import { v } from "convex/values";
import type { FunctionReference } from "convex/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { getSummaryAdapter } from "../../lib/ai/summary";
import { SummaryError, summaryInputSchema } from "../../lib/ai/summary-adapter";
import { extractBoardContent, hasSummarizableContent } from "../../lib/summary-input";

const MAX_DOUBTS = 40;

/**
 * Folder-nested Convex modules land under a slash-containing API key, and the
 * generated types cannot describe this module while it is itself being
 * generated. Same cast pattern as convex/exports.ts.
 */
type SelfApi = {
  gatherInput: FunctionReference<"query", "internal", { sessionId: Id<"sessions"> }, {
    title: string;
    subject?: string;
    durationMinutes?: number;
    boardVersion: number;
    sceneJson: string;
    doubts: { text: string; voteCount: number; answered: boolean }[];
  } | null>;
  markProcessing: FunctionReference<"mutation", "internal", { sessionId: Id<"sessions">; boardVersion?: number }, { summaryId: Id<"sessionSummaries"> } | null>;
  markReady: FunctionReference<"mutation", "internal", { sessionId: Id<"sessions">; notesJson: string; provider: string; latencyMs: number }, unknown>;
  markFailed: FunctionReference<"mutation", "internal", { sessionId: Id<"sessions">; errorCode: string; status?: "failed" | "skipped" }, unknown>;
};

const self = (internal as unknown as Record<string, SelfApi>)["internal/summarize"];

/** Session, final scene, and doubts in one read so the action stays single-pass. */
export const gatherInput = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || !session.latestSnapshotId) return null;
    const snapshot = await ctx.db.get(session.latestSnapshotId);
    if (!snapshot?.sceneJsonCompressed) return null;

    const doubts = await ctx.db
      .query("doubts")
      .withIndex("by_session_created", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(120);

    const useful = doubts
      .filter((doubt) => doubt.status === "accepted" || doubt.status === "answered")
      .sort((a, b) => b.voteCount - a.voteCount || a.createdAt - b.createdAt)
      .slice(0, MAX_DOUBTS)
      .map((doubt) => ({
        text: doubt.text.slice(0, 220),
        voteCount: doubt.voteCount,
        answered: doubt.status === "answered",
      }));

    const durationMinutes =
      session.startedAt && session.endedAt
        ? Math.max(0, Math.round((session.endedAt - session.startedAt) / 60_000))
        : undefined;

    return {
      title: session.title,
      subject: session.subject,
      durationMinutes,
      boardVersion: snapshot.boardVersion,
      sceneJson: snapshot.sceneJsonCompressed,
      doubts: useful,
    };
  },
});

export const markProcessing = internalMutation({
  args: { sessionId: v.id("sessions"), boardVersion: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sessionSummaries")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    // Re-running over a ready row is how "regenerate" works; a row already in
    // flight is left alone so a double schedule cannot double-charge the API.
    if (existing) {
      if (existing.status === "processing") return null;
      await ctx.db.patch(existing._id, {
        status: "processing",
        boardVersion: args.boardVersion,
        errorCode: undefined,
        completedAt: undefined,
      });
      return { summaryId: existing._id };
    }

    const summaryId = await ctx.db.insert("sessionSummaries", {
      sessionId: args.sessionId,
      status: "processing",
      boardVersion: args.boardVersion,
      createdAt: Date.now(),
    });
    return { summaryId };
  },
});

export const markReady = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    notesJson: v.string(),
    provider: v.string(),
    latencyMs: v.number(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("sessionSummaries")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .unique();
    if (!row) return null;
    await ctx.db.patch(row._id, {
      status: "ready",
      notesJson: args.notesJson,
      provider: args.provider,
      latencyMs: args.latencyMs,
      errorCode: undefined,
      completedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const markFailed = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    errorCode: v.string(),
    status: v.optional(v.union(v.literal("failed"), v.literal("skipped"))),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("sessionSummaries")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .unique();
    if (!row) return null;
    await ctx.db.patch(row._id, {
      status: args.status ?? "failed",
      errorCode: args.errorCode,
      completedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const run = internalAction({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const started = Date.now();
    const input = await ctx.runQuery(self.gatherInput, {
      sessionId: args.sessionId,
    });
    if (!input) return { ok: false as const, reason: "FINAL_SNAPSHOT_MISSING" as const };

    const claimed = await ctx.runMutation(self.markProcessing, {
      sessionId: args.sessionId,
      boardVersion: input.boardVersion,
    });
    if (!claimed) return { ok: false as const, reason: "ALREADY_PROCESSING" as const };

    const extract = extractBoardContent(input.sceneJson);
    if (!hasSummarizableContent(extract)) {
      await ctx.runMutation(self.markFailed, {
        sessionId: args.sessionId,
        errorCode: "SUMMARY_EMPTY_BOARD",
        status: "skipped",
      });
      return { ok: false as const, reason: "SUMMARY_EMPTY_BOARD" as const };
    }

    const parsedInput = summaryInputSchema.safeParse({
      title: input.title,
      subject: input.subject,
      boardText: extract.boardText,
      boardBlocks: extract.boardBlocks,
      doubts: input.doubts,
      durationMinutes: input.durationMinutes,
    });
    if (!parsedInput.success) {
      await ctx.runMutation(self.markFailed, {
        sessionId: args.sessionId,
        errorCode: "SUMMARY_INPUT_INVALID",
      });
      return { ok: false as const, reason: "SUMMARY_INPUT_INVALID" as const };
    }

    const adapter = getSummaryAdapter();
    try {
      const notes = await adapter.summarize(parsedInput.data);
      await ctx.runMutation(self.markReady, {
        sessionId: args.sessionId,
        notesJson: JSON.stringify(notes),
        provider: adapter.id,
        latencyMs: Date.now() - started,
      });
      return { ok: true as const, provider: adapter.id };
    } catch (error) {
      const code = error instanceof SummaryError ? error.code : "SUMMARY_GENERATION_FAILED";
      await ctx.runMutation(self.markFailed, {
        sessionId: args.sessionId,
        errorCode: code,
        status: code === "SUMMARY_PROVIDER_DISABLED" ? "skipped" : "failed",
      });
      return { ok: false as const, reason: code };
    }
  },
});
