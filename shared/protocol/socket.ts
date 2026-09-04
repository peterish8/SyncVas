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
  protocolError: "protocol:error",
} as const;

const classroomEnvelopeFields = {
  v: z.literal(SOCKET_PROTOCOL_VERSION),
  sessionId: z.string().min(1),
  ts: z.number().int().nonnegative(),
} as const;

const boardSceneSchema = z.unknown();

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
    files: z.unknown().optional(),
  })
  .strict();

export const boardRequestCurrentSchema = z
  .object({
    ...classroomEnvelopeFields,
  })
  .strict();

export const boardCurrentSchema = z
  .object({
    ...classroomEnvelopeFields,
    boardVersion: z.number().int().nonnegative(),
    scene: boardSceneSchema,
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

export const roomPresenceSchema = z
  .object({
    ...classroomEnvelopeFields,
    connectedCount: z.number().int().nonnegative(),
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
export type ProtocolError = z.infer<typeof protocolErrorSchema>;
