/** Phase 2 board sync: teacher writer, student read-only, versioning, room isolation. */

import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { io as createClient, type Socket as ClientSocket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";

import {
  SOCKET_EVENTS,
  SOCKET_PROTOCOL_VERSION,
  authRefreshAckSchema,
  boardCurrentSchema,
  boardUpdateAckSchema,
  boardUpdateSchema,
  protocolErrorSchema,
  teacherViewportSchema,
} from "@/shared/protocol/socket";
import { clearHotScene, markRoomRevoked } from "@/socket-server/src/board-hot-state";
import { createSocketServer } from "@/socket-server/src/server";

const SECRET = "phase-2-test-secret-that-is-at-least-32-bytes";
process.env.SOCKET_INTERNAL_SECRET = SECRET;

const clients: ClientSocket[] = [];
const servers: Array<{ close: () => Promise<void> }> = [];
const sessionIds: string[] = [];

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signedToken(sessionId: string, role: "teacher" | "student", subjectId = `${role}-1`, ttlSeconds = 300): string {
  const header = encode({ alg: "HS256", typ: "SVRT1" });
  const payload = encode({
    v: 1,
    sessionId,
    role,
    subjectId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  });
  const signature = createHmac("sha256", SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function envelope(sessionId: string) {
  return {
    v: SOCKET_PROTOCOL_VERSION,
    sessionId,
    ts: Date.now(),
  };
}

function waitForEvent<T>(socket: ClientSocket, event: string, timeoutMs = 2_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for ${event}.`));
    }, timeoutMs);

    const onEvent = (payload: T) => {
      clearTimeout(timeout);
      socket.off(event, onEvent);
      resolve(payload);
    };

    socket.once(event, onEvent);
  });
}

async function runningSocketServer() {
  const httpServer = createServer();
  const io = createSocketServer(httpServer, ["http://localhost:3000"]);
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP address.");
  servers.push({
    close: () => new Promise<void>((resolve) => io.close(() => httpServer.close(() => resolve()))),
  });
  return { io, url: `http://127.0.0.1:${address.port}` };
}

function connect(url: string, token: string): ClientSocket {
  const client = createClient(url, { auth: { token }, transports: ["websocket"] });
  clients.push(client);
  return client;
}

async function connectReady(url: string, sessionId: string, role: "teacher" | "student"): Promise<ClientSocket> {
  sessionIds.push(sessionId);
  const client = connect(url, signedToken(sessionId, role, `${role}-${sessionId}`));
  const presence = waitForEvent(client, SOCKET_EVENTS.roomPresence, 2_000);
  await new Promise<void>((resolve, reject) => {
    client.once("connect", () => resolve());
    client.once("connect_error", reject);
  });
  await presence.catch(() => undefined);
  return client;
}

afterEach(async () => {
  clients.splice(0).forEach((client) => client.disconnect());
  await Promise.all(servers.splice(0).map((server) => server.close()));
  for (const sessionId of sessionIds.splice(0)) {
    clearHotScene(sessionId);
  }
});

describe("board sync", () => {
  it("broadcasts teacher board:update, rejects student edits, and serves board:current", async () => {
    const sessionId = "board-sync-1";
    const { url } = await runningSocketServer();
    const teacher = await connectReady(url, sessionId, "teacher");
    const student = await connectReady(url, sessionId, "student");

    const update = waitForEvent<unknown>(student, SOCKET_EVENTS.boardUpdate);
    const files = { "file-1": { id: "file-1", mimeType: "image/svg+xml", dataURL: "data:image/svg+xml;base64,AA==", created: Date.now() } };
    teacher.emit(SOCKET_EVENTS.boardUpdate, {
      ...envelope(sessionId),
      boardVersion: 1,
      scene: { elements: [{ id: "stroke-1" }] },
      files,
    });
    const broadcast = boardUpdateSchema.parse(await update);
    expect(broadcast.boardVersion).toBe(1);
    expect(broadcast.files).toEqual(files);

    const rejected = waitForEvent<unknown>(student, SOCKET_EVENTS.protocolError);
    student.emit(SOCKET_EVENTS.boardUpdate, {
      ...envelope(sessionId),
      boardVersion: 2,
      scene: { elements: [{ id: "student-edit" }] },
    });
    expect(protocolErrorSchema.parse(await rejected).code).toBe("STUDENT_BOARD_EDIT_FORBIDDEN");

    const current = waitForEvent<unknown>(student, SOCKET_EVENTS.boardCurrent);
    student.emit(SOCKET_EVENTS.boardRequestCurrent, envelope(sessionId));
    const currentBoard = boardCurrentSchema.parse(await current);
    expect(currentBoard.boardVersion).toBe(1);
    expect(currentBoard.files).toEqual(files);
  });

  it("bootstraps a late joiner with only the latest canonical scene", async () => {
    const sessionId = "board-sync-late";
    const { url } = await runningSocketServer();
    const teacher = await connectReady(url, sessionId, "teacher");
    const observer = await connectReady(url, sessionId, "student");

    const first = waitForEvent<unknown>(observer, SOCKET_EVENTS.boardUpdate);
    teacher.emit(SOCKET_EVENTS.boardUpdate, {
      ...envelope(sessionId),
      boardVersion: 1,
      scene: { elements: [{ id: "old" }] },
    });
    await first;

    const second = waitForEvent<unknown>(observer, SOCKET_EVENTS.boardUpdate);
    teacher.emit(SOCKET_EVENTS.boardUpdate, {
      ...envelope(sessionId),
      boardVersion: 2,
      scene: { elements: [{ id: "latest" }] },
    });
    expect(boardUpdateSchema.parse(await second).boardVersion).toBe(2);

    const lateStudent = await connectReady(url, sessionId, "student");
    const current = waitForEvent<unknown>(lateStudent, SOCKET_EVENTS.boardCurrent);
    lateStudent.emit(SOCKET_EVENTS.boardRequestCurrent, envelope(sessionId));
    const board = boardCurrentSchema.parse(await current);
    expect(board.boardVersion).toBe(2);
    expect(board.scene).toEqual({ elements: [{ id: "latest" }] });
  });

  it("rejects stale teacher versions without changing the canonical scene", async () => {
    const sessionId = "board-sync-stale";
    const { url } = await runningSocketServer();
    const teacher = await connectReady(url, sessionId, "teacher");
    const student = await connectReady(url, sessionId, "student");

    const accepted = waitForEvent<unknown>(student, SOCKET_EVENTS.boardUpdate);
    teacher.emit(SOCKET_EVENTS.boardUpdate, {
      ...envelope(sessionId),
      boardVersion: 3,
      scene: { elements: [{ id: "new" }] },
    });
    await accepted;

    const stale = await teacher.timeout(2_000).emitWithAck(SOCKET_EVENTS.boardUpdate, {
      ...envelope(sessionId),
      boardVersion: 2,
      scene: { elements: [{ id: "stale" }] },
    });
    // The ack carries the relay's version, so the writer can move past it.
    expect(boardUpdateAckSchema.parse(stale)).toEqual({ ok: false, code: "STALE_BOARD_VERSION", boardVersion: 3 });

    const current = waitForEvent<unknown>(teacher, SOCKET_EVENTS.boardCurrent);
    teacher.emit(SOCKET_EVENTS.boardRequestCurrent, envelope(sessionId));
    const board = boardCurrentSchema.parse(await current);
    expect(board.boardVersion).toBe(3);
    expect(board.scene).toEqual({ elements: [{ id: "new" }] });
  });

  it("rejects student teacher:viewport with FORBIDDEN while teacher viewport still reaches students", async () => {
    const sessionId = "board-sync-view";
    const { url } = await runningSocketServer();
    const teacher = await connectReady(url, sessionId, "teacher");
    const student = await connectReady(url, sessionId, "student");
    const otherStudent = await connectReady(url, sessionId, "student");

    const rejected = waitForEvent<unknown>(student, SOCKET_EVENTS.protocolError);
    student.emit(SOCKET_EVENTS.teacherViewport, {
      ...envelope(sessionId),
      x: 100,
      y: 200,
      zoom: 2,
    });
    expect(protocolErrorSchema.parse(await rejected).code).toBe("FORBIDDEN");

    const teacherViewport = waitForEvent<unknown>(otherStudent, SOCKET_EVENTS.teacherViewport);
    teacher.emit(SOCKET_EVENTS.teacherViewport, {
      ...envelope(sessionId),
      x: 10,
      y: 20,
      zoom: 1.25,
    });
    expect(teacherViewportSchema.parse(await teacherViewport).x).toBe(10);
  });

  it("isolates board:update across rooms", async () => {
    const sessionA = "board-sync-room-a";
    const sessionB = "board-sync-room-b";
    const { url } = await runningSocketServer();
    const teacherA = await connectReady(url, sessionA, "teacher");
    const studentA = await connectReady(url, sessionA, "student");
    const studentB = await connectReady(url, sessionB, "student");

    const receivedInA = waitForEvent<unknown>(studentA, SOCKET_EVENTS.boardUpdate);
    const leak = new Promise<"leak" | "ok">((resolve) => {
      const timeout = setTimeout(() => resolve("ok"), 500);
      studentB.once(SOCKET_EVENTS.boardUpdate, () => {
        clearTimeout(timeout);
        resolve("leak");
      });
    });

    teacherA.emit(SOCKET_EVENTS.boardUpdate, {
      ...envelope(sessionA),
      boardVersion: 1,
      scene: { elements: [{ id: "only-a" }] },
    });

    expect(boardUpdateSchema.parse(await receivedInA).sessionId).toBe(sessionA);
    expect(await leak).toBe("ok");
  });
});

describe("board sync reliability", () => {
  const emptyUpdate = (sessionId: string, boardVersion: number) => ({
    ...envelope(sessionId),
    boardVersion,
    scene: { elements: [] },
  });

  it("acknowledges every rejected board:update so a writer never waits forever", async () => {
    const sessionId = "board-sync-ack-reject";
    const { url } = await runningSocketServer();
    const teacher = await connectReady(url, sessionId, "teacher");
    const student = await connectReady(url, sessionId, "student");

    const forbidden = await student.timeout(2_000).emitWithAck(SOCKET_EVENTS.boardUpdate, emptyUpdate(sessionId, 1));
    expect(boardUpdateAckSchema.parse(forbidden)).toEqual({ ok: false, code: "STUDENT_BOARD_EDIT_FORBIDDEN" });

    // Rejections from the live-claims gate used to return without any reply.
    markRoomRevoked(sessionId);
    const revoked = await teacher.timeout(2_000).emitWithAck(SOCKET_EVENTS.boardUpdate, emptyUpdate(sessionId, 1));
    expect(boardUpdateAckSchema.parse(revoked)).toEqual({ ok: false, code: "ROOM_REVOKED" });
  });

  it("renews a live socket's claims in band once its token lapses", async () => {
    const sessionId = "board-sync-auth-refresh";
    const subjectId = "teacher-refresh";
    const { url } = await runningSocketServer();
    sessionIds.push(sessionId);
    const teacher = connect(url, signedToken(sessionId, "teacher", subjectId, 2));
    await new Promise<void>((resolve, reject) => {
      teacher.once("connect", () => resolve());
      teacher.once("connect_error", reject);
    });

    await new Promise((resolve) => setTimeout(resolve, 2_100));
    const expired = await teacher.timeout(2_000).emitWithAck(SOCKET_EVENTS.boardUpdate, emptyUpdate(sessionId, 1));
    expect(boardUpdateAckSchema.parse(expired)).toEqual({ ok: false, code: "TOKEN_EXPIRED" });

    const renewed = await teacher.timeout(2_000).emitWithAck(SOCKET_EVENTS.authRefresh, {
      ...envelope(sessionId),
      token: signedToken(sessionId, "teacher", subjectId),
    });
    expect(authRefreshAckSchema.parse(renewed).ok).toBe(true);

    const accepted = await teacher.timeout(2_000).emitWithAck(SOCKET_EVENTS.boardUpdate, emptyUpdate(sessionId, 1));
    expect(boardUpdateAckSchema.parse(accepted)).toEqual({ ok: true, boardVersion: 1 });
    expect(teacher.connected).toBe(true);
  }, 10_000);

  it("refuses an auth:refresh that would change room, role or subject", async () => {
    const sessionId = "board-sync-auth-identity";
    const { url } = await runningSocketServer();
    const student = await connectReady(url, sessionId, "student");
    const subjectId = `student-${sessionId}`;
    const attempt = async (token: string) =>
      authRefreshAckSchema.parse(
        await student.timeout(2_000).emitWithAck(SOCKET_EVENTS.authRefresh, { ...envelope(sessionId), token }),
      );

    expect(await attempt(signedToken(sessionId, "teacher", subjectId))).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(await attempt(signedToken(sessionId, "student", "someone-else"))).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(await attempt(signedToken("another-room", "student", subjectId))).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(await attempt("not-a-token")).toEqual({ ok: false, code: "UNAUTHORIZED" });

    // A refused promotion changes nothing: the socket is still a student.
    const edit = await student.timeout(2_000).emitWithAck(SOCKET_EVENTS.boardUpdate, emptyUpdate(sessionId, 1));
    expect(boardUpdateAckSchema.parse(edit)).toEqual({ ok: false, code: "STUDENT_BOARD_EDIT_FORBIDDEN" });
  });
});
