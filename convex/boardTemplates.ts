/**
 * @phase 11
 * Prepared boards and the teacher's template library — PREP-01..05.
 *
 * A template is a durable, teacher-owned Excalidraw scene. Starting a class from
 * one seeds the live board through the existing board path, so students need no
 * change and every element stays editable during the lesson.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getLocalDevTeacher, requireLocalDevTeacher, requireTeacher } from "./auth";
import { normalizeTemplateTitle, validateSceneJson } from "../shared/board/scene";

const ORIGIN = v.union(v.literal("authored"), v.literal("ai-assisted"));

/** Summary shape for the library list: never ships the whole scene. */
function toSummary(row: Doc<"boardTemplates">) {
  return {
    templateId: row._id,
    title: row.title,
    subject: row.subject,
    origin: row.origin,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function ownedTemplate(
  ctx: QueryCtx | MutationCtx,
  teacherId: Id<"users">,
  templateId: Id<"boardTemplates">,
): Promise<Doc<"boardTemplates">> {
  const template = await ctx.db.get(templateId);
  // A miss and a foreign template are indistinguishable to the caller.
  if (!template || template.teacherId !== teacherId) {
    throw new Error("NOT_FOUND: Template not found.");
  }
  return template;
}

async function insertTemplate(
  ctx: MutationCtx,
  teacherId: Id<"users">,
  args: { title: string; subject?: string; sceneJson: string; blockSources?: string; origin: "authored" | "ai-assisted" },
) {
  const title = normalizeTemplateTitle(args.title);
  validateSceneJson(args.sceneJson);
  const now = Date.now();
  const templateId = await ctx.db.insert("boardTemplates", {
    teacherId,
    title,
    subject: args.subject?.trim() || undefined,
    sceneJson: args.sceneJson,
    blockSources: args.blockSources,
    origin: args.origin,
    createdAt: now,
    updatedAt: now,
  });
  return { templateId, title };
}

async function listTemplates(ctx: QueryCtx, teacherId: Id<"users">) {
  const rows = await ctx.db
    .query("boardTemplates")
    .withIndex("by_teacher_updated", (q) => q.eq("teacherId", teacherId))
    .order("desc")
    .take(200);
  return rows.map(toSummary);
}

/* PREP-01 — save the current board as a reusable template. */

export const save = mutation({
  args: {
    title: v.string(),
    subject: v.optional(v.string()),
    sceneJson: v.string(),
    blockSources: v.optional(v.string()),
    origin: v.optional(ORIGIN),
  },
  handler: async (ctx, args) => {
    const teacher = await requireTeacher(ctx);
    return await insertTemplate(ctx, teacher._id, { ...args, origin: args.origin ?? "authored" });
  },
});

export const saveAsLocalTeacher = mutation({
  args: {
    title: v.string(),
    subject: v.optional(v.string()),
    sceneJson: v.string(),
    blockSources: v.optional(v.string()),
    origin: v.optional(ORIGIN),
  },
  handler: async (ctx, args) => {
    const teacher = await requireLocalDevTeacher(ctx);
    return await insertTemplate(ctx, teacher._id, { ...args, origin: args.origin ?? "authored" });
  },
});

/* PREP-02 — list, open, rename and delete, scoped to the owning teacher. */

export const list = query({
  args: {},
  handler: async (ctx) => {
    const teacher = await requireTeacher(ctx);
    return await listTemplates(ctx, teacher._id);
  },
});

export const listAsLocalTeacher = query({
  args: {},
  handler: async (ctx) => {
    const teacher = await getLocalDevTeacher(ctx);
    if (!teacher) return [];
    return await listTemplates(ctx, teacher._id);
  },
});

export const get = query({
  args: { templateId: v.id("boardTemplates") },
  handler: async (ctx, args) => {
    const teacher = await requireTeacher(ctx);
    const template = await ownedTemplate(ctx, teacher._id, args.templateId);
    return { ...toSummary(template), sceneJson: template.sceneJson, blockSources: template.blockSources };
  },
});

export const getAsLocalTeacher = query({
  args: { templateId: v.id("boardTemplates") },
  handler: async (ctx, args) => {
    const teacher = await getLocalDevTeacher(ctx);
    if (!teacher) throw new Error("NOT_FOUND: Template not found.");
    const template = await ownedTemplate(ctx, teacher._id, args.templateId);
    return { ...toSummary(template), sceneJson: template.sceneJson, blockSources: template.blockSources };
  },
});

export const rename = mutation({
  args: { templateId: v.id("boardTemplates"), title: v.string() },
  handler: async (ctx, args) => {
    const teacher = await requireTeacher(ctx);
    const template = await ownedTemplate(ctx, teacher._id, args.templateId);
    const title = normalizeTemplateTitle(args.title);
    await ctx.db.patch(template._id, { title, updatedAt: Date.now() });
    return { templateId: template._id, title };
  },
});

export const renameAsLocalTeacher = mutation({
  args: { templateId: v.id("boardTemplates"), title: v.string() },
  handler: async (ctx, args) => {
    const teacher = await requireLocalDevTeacher(ctx);
    const template = await ownedTemplate(ctx, teacher._id, args.templateId);
    const title = normalizeTemplateTitle(args.title);
    await ctx.db.patch(template._id, { title, updatedAt: Date.now() });
    return { templateId: template._id, title };
  },
});

export const remove = mutation({
  args: { templateId: v.id("boardTemplates") },
  handler: async (ctx, args) => {
    const teacher = await requireTeacher(ctx);
    const template = await ownedTemplate(ctx, teacher._id, args.templateId);
    await ctx.db.delete(template._id);
    return { templateId: args.templateId };
  },
});

export const removeAsLocalTeacher = mutation({
  args: { templateId: v.id("boardTemplates") },
  handler: async (ctx, args) => {
    const teacher = await requireLocalDevTeacher(ctx);
    const template = await ownedTemplate(ctx, teacher._id, args.templateId);
    await ctx.db.delete(template._id);
    return { templateId: args.templateId };
  },
});

/**
 * PREP-03 — the scene a session should open on.
 *
 * Returned to the teacher client, which loads it into Excalidraw and publishes
 * it as the first board version. Students then receive it through the existing
 * `board:current` bootstrap (PREP-04), and because it arrives as ordinary
 * elements it stays fully editable (PREP-05).
 */
export const getStartingScene = query({
  args: { templateId: v.id("boardTemplates") },
  handler: async (ctx, args) => {
    const teacher = await requireTeacher(ctx);
    const template = await ownedTemplate(ctx, teacher._id, args.templateId);
    return { templateId: template._id, title: template.title, sceneJson: template.sceneJson };
  },
});

export const getStartingSceneAsLocalTeacher = query({
  args: { templateId: v.id("boardTemplates") },
  handler: async (ctx, args) => {
    const teacher = await getLocalDevTeacher(ctx);
    if (!teacher) throw new Error("NOT_FOUND: Template not found.");
    const template = await ownedTemplate(ctx, teacher._id, args.templateId);
    return { templateId: template._id, title: template.title, sceneJson: template.sceneJson };
  },
});
