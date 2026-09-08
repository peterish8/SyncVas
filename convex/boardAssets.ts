/** Authorized durable Excalidraw binary assets. */

import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireSessionOwner } from "./permissions";
import { fail } from "./errors";

export const MAX_ASSET_BYTES = 2_000_000;
export const MAX_ASSETS_PER_SESSION = 100;
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/octet-stream",
]);

function validateAsset(fileId: string, mimeType: string, byteSize: number): void {
  if (!/^[A-Za-z0-9_-]{1,128}$/u.test(fileId)) fail("INVALID_ASSET_ID", "Invalid board asset id.");
  if (!ALLOWED_MIME_TYPES.has(mimeType)) fail("UNSUPPORTED_ASSET_TYPE", "This board image type is not supported.");
  if (!Number.isInteger(byteSize) || byteSize < 1 || byteSize > MAX_ASSET_BYTES) {
    fail("ASSET_TOO_LARGE", "Board assets must be 2 MB or smaller.");
  }
}

async function registerAsset(
  ctx: { db: MutationCtx["db"]; storage: MutationCtx["storage"] },
  sessionId: Id<"sessions">,
  fileId: string,
  mimeType: string,
  byteSize: number,
  storageId: Id<"_storage">,
) {
  validateAsset(fileId, mimeType, byteSize);
  const actual = await ctx.db.system.get("_storage", storageId);
  if (!actual || actual.size < 1 || actual.size > MAX_ASSET_BYTES || actual.size !== byteSize) {
    fail("ASSET_SIZE_MISMATCH", "Uploaded asset size could not be verified.");
  }
  const existing = await ctx.db.query("boardAssets").withIndex("by_session_file", (q) => q.eq("sessionId", sessionId).eq("fileId", fileId)).unique();
  if (existing) {
    await ctx.db.patch(existing._id, { mimeType, byteSize, storageId, createdAt: Date.now() });
    return existing._id;
  }
  const count = await ctx.db.query("boardAssets").withIndex("by_session_created", (q) => q.eq("sessionId", sessionId)).collect();
  if (count.length >= MAX_ASSETS_PER_SESSION) fail("ASSET_COUNT_LIMIT", "This room has reached its image limit.");
  return await ctx.db.insert("boardAssets", { sessionId, fileId, mimeType, byteSize, storageId, createdAt: Date.now() });
}

export const generateUploadUrl = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const { session } = await requireSessionOwner(ctx, args.sessionId);
    if (session.status !== "live" && session.status !== "ending") fail("SESSION_NOT_LIVE", "Assets can only be added to a live room.");
    return await ctx.storage.generateUploadUrl();
  },
});

export const register = mutation({
  args: { sessionId: v.id("sessions"), fileId: v.string(), mimeType: v.string(), byteSize: v.number(), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const { session } = await requireSessionOwner(ctx, args.sessionId);
    if (session.status !== "live" && session.status !== "ending") fail("SESSION_NOT_LIVE", "Assets can only be added to a live room.");
    return await registerAsset(ctx, args.sessionId, args.fileId, args.mimeType, args.byteSize, args.storageId);
  },
});

type AssetRow = { fileId: string; mimeType: string; storageId: Id<"_storage">; url: string | null };

async function listAssets(ctx: { db: QueryCtx["db"]; storage: QueryCtx["storage"] }, sessionId: Id<"sessions">): Promise<AssetRow[]> {
  const rows = await ctx.db.query("boardAssets").withIndex("by_session_created", (q) => q.eq("sessionId", sessionId)).order("asc").take(MAX_ASSETS_PER_SESSION);
  return await Promise.all(rows.map(async (row) => ({ fileId: row.fileId, mimeType: row.mimeType, storageId: row.storageId, url: await ctx.storage.getUrl(row.storageId) })));
}

export const listForTeacher = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    await requireSessionOwner(ctx, args.sessionId);
    return await listAssets(ctx, args.sessionId);
  },
});

export const listForParticipant = query({
  args: { sessionId: v.id("sessions"), participantId: v.id("participants") },
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId);
    if (!participant || participant.sessionId !== args.sessionId || (participant.blockedUntil ?? 0) > Date.now()) fail("FORBIDDEN", "Participant is not admitted to this room.");
    return await listAssets(ctx, args.sessionId);
  },
});

export const listForExport = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => await listAssets(ctx, args.sessionId),
});
