import { describe, expect, it } from "vitest";

import {
  SOCKET_EVENTS,
  SOCKET_PROTOCOL_VERSION,
  boardCurrentSchema,
  boardRequestCurrentSchema,
  boardUpdateSchema,
  foundationPingSchema,
  foundationPongSchema,
  protocolErrorSchema,
  roomJoinSchema,
  roomPresenceSchema,
  teacherViewportSchema,
} from "@/shared/protocol/socket";

describe("foundation socket protocol", () => {
  it("accepts the versioned health ping and pong envelopes", () => {
    expect(foundationPingSchema.safeParse({ v: SOCKET_PROTOCOL_VERSION, sentAt: 1 }).success).toBe(true);
    expect(foundationPongSchema.safeParse({ v: SOCKET_PROTOCOL_VERSION, sentAt: 1, receivedAt: 2 }).success).toBe(true);
  });

  it("rejects unknown fields and a mismatched protocol version", () => {
    expect(foundationPingSchema.safeParse({ v: 2, sentAt: 1 }).success).toBe(false);
    expect(
      foundationPongSchema.safeParse({
        v: SOCKET_PROTOCOL_VERSION,
        sentAt: 1,
        receivedAt: 2,
        role: "teacher",
      }).success,
    ).toBe(false);
  });
});

describe("classroom socket protocol events", () => {
  it("keeps SOCKET_PROTOCOL_VERSION at 1 and documents docs/11 event names", () => {
    expect(SOCKET_PROTOCOL_VERSION).toBe(1);
    expect(SOCKET_EVENTS).toMatchObject({
      foundationPing: "foundation:ping",
      foundationPong: "foundation:pong",
      roomJoin: "room:join",
      boardUpdate: "board:update",
      boardRequestCurrent: "board:request-current",
      teacherViewport: "teacher:viewport",
      boardCurrent: "board:current",
      roomPresence: "room:presence",
      protocolError: "protocol:error",
    });
  });

  it("does not define student cursor, chat, or Yjs/CRDT event families", () => {
    const names = Object.values(SOCKET_EVENTS).join(" ");
    const keys = Object.keys(SOCKET_EVENTS).join(" ");
    for (const forbidden of ["cursor", "chat", "yjs", "crdt"]) {
      expect(names.toLowerCase()).not.toContain(forbidden);
      expect(keys.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("accepts versioned board, viewport, presence, and error envelopes", () => {
    expect(
      boardUpdateSchema.safeParse({
        v: SOCKET_PROTOCOL_VERSION,
        sessionId: "sess_1",
        ts: 100,
        boardVersion: 3,
        scene: { elements: [], appState: {} },
        files: { fileA: { id: "fileA", mimeType: "image/png", dataURL: "data:image/png;base64,AA==", created: 1 } },
      }).success,
    ).toBe(true);

    expect(
      boardCurrentSchema.safeParse({
        v: SOCKET_PROTOCOL_VERSION,
        sessionId: "sess_1",
        ts: 101,
        boardVersion: 3,
        scene: { elements: [{ id: "a" }] },
      }).success,
    ).toBe(true);

    expect(
      boardRequestCurrentSchema.safeParse({
        v: SOCKET_PROTOCOL_VERSION,
        sessionId: "sess_1",
        ts: 102,
      }).success,
    ).toBe(true);

    expect(
      teacherViewportSchema.safeParse({
        v: SOCKET_PROTOCOL_VERSION,
        sessionId: "sess_1",
        ts: 103,
        x: 10,
        y: -4,
        zoom: 1.25,
        pageId: "page-1",
      }).success,
    ).toBe(true);

    expect(
      roomPresenceSchema.safeParse({
        v: SOCKET_PROTOCOL_VERSION,
        sessionId: "sess_1",
        ts: 104,
        connectedCount: 12,
      }).success,
    ).toBe(true);

    expect(
      protocolErrorSchema.safeParse({
        v: SOCKET_PROTOCOL_VERSION,
        sessionId: "sess_1",
        ts: 105,
        code: "STUDENT_BOARD_EDIT_FORBIDDEN",
        message: "Students cannot mutate the board.",
      }).success,
    ).toBe(true);

    expect(
      roomJoinSchema.safeParse({
        v: SOCKET_PROTOCOL_VERSION,
        sessionId: "sess_1",
        ts: 106,
      }).success,
    ).toBe(true);
  });

  it("rejects mismatched versions, unknown keys, and missing required fields", () => {
    expect(
      boardUpdateSchema.safeParse({
        v: 2,
        sessionId: "sess_1",
        ts: 100,
        boardVersion: 1,
        scene: {},
      }).success,
    ).toBe(false);

    expect(
      teacherViewportSchema.safeParse({
        v: SOCKET_PROTOCOL_VERSION,
        sessionId: "sess_1",
        ts: 100,
        x: 0,
        y: 0,
        zoom: 1,
        role: "teacher",
      }).success,
    ).toBe(false);

    expect(
      boardCurrentSchema.safeParse({
        v: SOCKET_PROTOCOL_VERSION,
        sessionId: "sess_1",
        ts: 100,
        scene: {},
      }).success,
    ).toBe(false);

    expect(
      roomPresenceSchema.safeParse({
        v: SOCKET_PROTOCOL_VERSION,
        sessionId: "sess_1",
        ts: 100,
        connectedCount: 2,
        studentIds: ["a"],
      }).success,
    ).toBe(false);

    expect(
      protocolErrorSchema.safeParse({
        v: SOCKET_PROTOCOL_VERSION,
        sessionId: "sess_1",
        ts: 100,
        code: "",
        message: "bad",
      }).success,
    ).toBe(false);
  });
});
