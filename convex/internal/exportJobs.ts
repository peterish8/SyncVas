/** In-process export generation from the final scene. */

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

function escapeXml(value: string): string {
  return value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
}

export const processNext = internalAction({
  args: { exportId: v.id("exports") },
  handler: async (ctx, args) => {
    const job = await ctx.runMutation(internal.exports.markProcessing, { exportId: args.exportId });
    if (!job) return { ok: false, reason: "missing" };
    try {
      const snapshot = job.sessionId ? await ctx.runQuery(internal.boardSnapshots.getFinalForExport, { sessionId: job.sessionId }) : null;
      if (!snapshot?.sceneJsonCompressed) throw new Error("FINAL_SCENE_MISSING");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="white"/><text x="32" y="52" font-family="sans-serif" font-size="24">SyncVas final board</text><text x="32" y="88" font-family="monospace" font-size="11">${escapeXml(snapshot.sceneJsonCompressed.slice(0, 10000))}</text></svg>`;
      const storageId = await ctx.storage.store(new Blob([svg], { type: "image/svg+xml" }));
      await ctx.runMutation(internal.exports.markReady, { exportId: args.exportId, storageId });
      return { ok: true, storageId };
    } catch {
      await ctx.runMutation(internal.exports.markFailed, { exportId: args.exportId, errorCode: "EXPORT_GENERATION_FAILED" });
      return { ok: false, reason: "EXPORT_GENERATION_FAILED" };
    }
  },
});
