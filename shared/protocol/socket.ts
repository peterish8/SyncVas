/**
 * @scaffold annotate
 * @phase 1 (foundation done) → extend in Phases 2 & 4
 *
 * Phase 1: SOCKET_PROTOCOL_VERSION, foundation ping/pong, strict envelopes.
 * Phase 2: board:update / board:request-current / board:current (+ protocol:error).
 * Phase 3: room:join + socketAuth (token claims; role never trusted from client alone).
 * Phase 4: teacher:viewport + room:presence.
 * auth:refresh renews a live socket's admission in band (same identity only).
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
  authRefresh: "auth:refresh",
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

/**
 * Payload ceilings for a single `board:update`.
 *
 * These are the single source of truth: the Zod schemas below enforce them, and the
 * Socket.IO transport derives `maxHttpBufferSize` from `MAX_BOARD_ENVELOPE_BYTES`.
 * Raising a limit here without the transport following would make oversized frames
 * die at the transport layer (which closes the connection) instead of failing
 * validation cleanly, so never inline these numbers again.
 */
export const MAX_BOARD_SCENE_BYTES = 900_000;
export const MAX_BOARD_FILES_BYTES = 2_000_000;

/** Scene + files + envelope/encoding overhead, used to size the transport buffer. */
export const MAX_BOARD_ENVELOPE_BYTES = MAX_BOARD_SCENE_BYTES + MAX_BOARD_FILES_BYTES + 600_000;

function boundedJsonValue<T extends z.ZodTypeAny>(schema: T, maxBytes: number) {
  return schema.refine((value) => {
    try {
      const serialized = JSON.stringify(value);
      return typeof serialized === "string" && new TextEncoder().encode(serialized).byteLength <= maxBytes;
    } catch {
      return false;
    }
  }, "Payload exceeds the classroom size limit.");
}

const boardElementSchema = z.record(z.string(), z.unknown());
const boardSceneSchema = boundedJsonValue(
  z.object({
    elements: z.array(boardElementSchema).max(500),
    appState: z.record(z.string(), z.unknown()).optional(),
  }).passthrough(),
  MAX_BOARD_SCENE_BYTES,
);
const boardFileSchema = z.object({
  id: z.string().min(1).max(128),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml", "application/octet-stream"]),
  dataURL: z.string().min(1).max(2_800_000),
  created: z.number().int().nonnegative(),
  lastRetrieved: z.number().int().nonnegative().optional(),
  version: z.number().int().positive().optional(),
}).passthrough();
const boardFilesSchema = boundedJsonValue(
  z.record(z.string().min(1).max(128), boardFileSchema).superRefine((files, ctx) => {
    if (Object.keys(files).length > 100) ctx.addIssue({ code: "custom", message: "Too many board files." });
  }),
  MAX_BOARD_FILES_BYTES,
);

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

/**
 * Acknowledgement for `board:update`. The relay acks every outcome, so a writer
 * never waits on a reply that is not coming. A stale rejection carries the
 * relay's current version so the writer can move past it rather than retrying
 * the same number until it reconnects.
 */
export const boardUpdateAckSchema = z.union([
  z.object({ ok: z.literal(true), boardVersion: z.number().int().nonnegative() }).strict(),
  z
    .object({
      ok: z.literal(false),
      code: z.string().min(1),
      boardVersion: z.number().int().nonnegative().optional(),
    })
    .strict(),
]);

/**
 * Renew a live socket's admission with a freshly minted token.
 *
 * Room tokens are short-lived. Rotating the socket on every refresh cost each
 * client a full-scene resync every few minutes and dropped the teacher's
 * in-flight publish, so the token is renewed in band instead. The relay only
 * accepts a token for the identity admitted at handshake.
 */
export const authRefreshSchema = z
  .object({
    ...classroomEnvelopeFields,
    token: z.string().min(1).max(4_096),
  })
  .strict();

export const authRefreshAckSchema = z.union([
  z.object({ ok: z.literal(true), exp: z.number().int().positive() }).strict(),
  z.object({ ok: z.literal(false), code: z.string().min(1) }).strict(),
]);

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
export type BoardUpdateAck = z.infer<typeof boardUpdateAckSchema>;
export type AuthRefresh = z.infer<typeof authRefreshSchema>;
export type AuthRefreshAck = z.infer<typeof authRefreshAckSchema>;
export type ProtocolError = z.infer<typeof protocolErrorSchema>;
