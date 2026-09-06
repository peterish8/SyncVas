/** Final board snapshot persistence. */

import { v } from "convex/values";
import { mutation, query, internalQuery, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireLocalDevSessionOwner, requireSessionOwner } from "./auth";
import { validateSceneJson } from "../shared/board/scene";

async function save(ctx: MutationCtx, sessionId: Id<"sessions">, boardVersion: number, sceneJson: string) {
  if (!Number.isInteger(boardVersion) || boardVersion < 0) {
    throw new Error("INVALID_BOARD_VERSION: Board version must be a non-negative integer.");
  }
  validateSceneJson(sceneJson);
  const session = await ctx.db.get(sessionId);
  if (!session || (session.status !== "live" && session.status !== "ending")) {
    throw new Error("SESSION_NOT_LIVE: Final snapshot requires a live room.");
  }
  const existing = await ctx.db
    .query("boardSnapshots")
    .withIndex("by_session_version", (q) => q.eq("sessionId", sessionId).eq("boardVersion", boardVersion))
    .unique();
  const snapshotId = existing?._id ?? await ctx.db.insert("boardSnapshots", {
    sessionId,
    boardVersion,
    sceneJsonCompressed: sceneJson,
    kind: "final",
    createdAt: Date.now(),
  });
  if (existing) await ctx.db.patch(existing._id, { sceneJsonCompressed: sceneJson, kind: "final", createdAt: Date.now() });
  await ctx.db.patch(sessionId, { latestBoardVersion: boardVersion, latestSnapshotId: snapshotId });
  return { snapshotId, boardVersion };
}

export const saveFinal = mutation({
  args: { sessionId: v.id("sessions"), boardVersion: v.number(), sceneJson: v.string() },
  handler: async (ctx, args) => {
    await requireSessionOwner(ctx, args.sessionId);
    return await save(ctx, args.sessionId, args.boardVersion, args.sceneJson);
  },
});

export const saveFinalAsLocalTeacher = mutation({
  args: { sessionId: v.id("sessions"), boardVersion: v.number(), sceneJson: v.string() },
  handler: async (ctx, args) => {
    await requireLocalDevSessionOwner(ctx, args.sessionId);
    return await save(ctx, args.sessionId, args.boardVersion, args.sceneJson);
  },
});

export const getLatestFinal = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const { session } = await requireSessionOwner(ctx, args.sessionId);
    if (!session.latestSnapshotId) return null;
    return await ctx.db.get(session.latestSnapshotId);
  },
});

export const getFinalForExport = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session?.latestSnapshotId) return null;
    return await ctx.db.get(session.latestSnapshotId);
  },
});
