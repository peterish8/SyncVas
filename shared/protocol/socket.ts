/**
 * @scaffold annotate
 * @phase 1 (foundation done) → extend in Phases 2 & 4
 *
 * Phase 1: SOCKET_PROTOCOL_VERSION, foundation ping/pong, strict envelopes.
 * Phase 2: board:update / board:request-current / board:current (+ protocol:error).
 * Phase 3: room:join + socketAuth (token claims; role never trusted from client alone).
 * Phase 4: teacher:viewport + room:presence.
 * Do NOT add Yjs, cursors, or chat events in MVP.
 */
import { z } from "zod";

export const SOCKET_PROTOCOL_VERSION = 1 as const;

export const SOCKET_EVENTS = {
  foundationPing: "foundation:ping",
  foundationPong: "foundation:pong",
  roomJoin: "room:join",
  boardUpdate: "board:update",
  boardRequestCurrent: "board:request-current",
  teacherViewport: "teacher:viewport",
  boardCurrent: "board:current",
  roomPresence: "room:presence",
  blockHighlight: "block:highlight",
  protocolError: "protocol:error",
} as const;

/** Connection identity is established at handshake time, never per event. */
export const socketAuthSchema = z
  .object({
    sessionId: z.string().min(1),
    role: z.enum(["teacher", "student"]),
    subjectId: z.string().min(1).optional(),
    exp: z.number().int().positive().optional(),
  })
  .strict();

export type SocketAuth = z.infer<typeof socketAuthSchema>;

const classroomEnvelopeFields = {
  v: z.literal(SOCKET_PROTOCOL_VERSION),
  sessionId: z.string().min(1),
  ts: z.number().int().nonnegative(),
} as const;

function boundedJsonValue(maxBytes: number) {
  return z.unknown().refine((value) => {
    try {
      const serialized = JSON.stringify(value);
      return typeof serialized === "string" && new TextEncoder().encode(serialized).byteLength <= maxBytes;
    } catch {
      return false;
    }
  }, "Payload exceeds the classroom size limit.");
}

const boardSceneSchema = boundedJsonValue(900_000);
const boardFilesSchema = boundedJsonValue(2_000_000);

export const foundationPingSchema = z
  .object({
    v: z.literal(SOCKET_PROTOCOL_VERSION),
    sentAt: z.number().int().nonnegative(),
  })
  .strict();

export const foundationPongSchema = z
  .object({
    v: z.literal(SOCKET_PROTOCOL_VERSION),
    sentAt: z.number().int().nonnegative(),
    receivedAt: z.number().int().nonnegative(),
  })
  .strict();

export const roomJoinSchema = z
  .object({
    ...classroomEnvelopeFields,
  })
  .strict();

export const boardUpdateSchema = z
  .object({
    ...classroomEnvelopeFields,
    boardVersion: z.number().int().nonnegative(),
    scene: boardSceneSchema,
    files: boardFilesSchema.optional(),
  })
  .strict();

export const boardRequestCurrentSchema = z
  .object({
    ...classroomEnvelopeFields,
  })
  .strict();

export const teacherViewportSchema = z
  .object({
    ...classroomEnvelopeFields,
    x: z.number(),
    y: z.number(),
    zoom: z.number().positive(),
    pageId: z.string().optional(),
  })
  .strict();

export const boardCurrentSchema = z
  .object({
    ...classroomEnvelopeFields,
    boardVersion: z.number().int().nonnegative(),
    scene: boardSceneSchema,
    files: boardFilesSchema.optional(),
    teacherViewport: teacherViewportSchema.optional(),
  })
  .strict();

export const roomPresenceSchema = z
  .object({
    ...classroomEnvelopeFields,
    connectedCount: z.number().int().nonnegative(),
  })
  .strict();

export const blockHighlightSchema = z
  .object({
    ...classroomEnvelopeFields,
    blockId: z.string().min(1).max(120),
    startLine: z.number().int().positive().max(500),
    endLine: z.number().int().positive().max(500).optional(),
  })
  .strict();

export const protocolErrorSchema = z
  .object({
    ...classroomEnvelopeFields,
    code: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

export type FoundationPing = z.infer<typeof foundationPingSchema>;
export type FoundationPong = z.infer<typeof foundationPongSchema>;
export type RoomJoin = z.infer<typeof roomJoinSchema>;
export type BoardUpdate = z.infer<typeof boardUpdateSchema>;
export type BoardRequestCurrent = z.infer<typeof boardRequestCurrentSchema>;
export type BoardCurrent = z.infer<typeof boardCurrentSchema>;
export type TeacherViewport = z.infer<typeof teacherViewportSchema>;
export type RoomPresence = z.infer<typeof roomPresenceSchema>;
export type BlockHighlight = z.infer<typeof blockHighlightSchema>;
export type ProtocolError = z.infer<typeof protocolErrorSchema>;
