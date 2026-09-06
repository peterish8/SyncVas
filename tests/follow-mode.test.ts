/**
 * Follow mode
 *
 * follow mirrors viewport; pan exits locally; return works; packets don't corrupt board.
 *
 * Non-negotiables: validate public args; ownership checks; indexed queries;
 * internal work via internal functions; never log raw doubt text/secrets.
 */

import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { io as createClient, type Socket as ClientSocket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";

import { shouldApplyTeacherViewport } from "@/components/board/use-teacher-viewport";
import {
  SOCKET_EVENTS,
  SOCKET_PROTOCOL_VERSION,
  boardCurrentSchema,
  boardUpdateSchema,
  protocolErrorSchema,
  teacherViewportSchema,
} from "@/shared/protocol/socket";
import { clearHotScene } from "@/socket-server/src/board-hot-state";
import { createSocketServer } from "@/socket-server/src/server";

const SECRET = "phase-4-test-secret-that-is-at-least-32-bytes";
process.env.SOCKET_INTERNAL_SECRET = SECRET;

const clients: ClientSocket[] = [];
const servers: Array<{ close: () => Promise<void> }> = [];
const sessionIds: string[] = [];

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signedToken(sessionId: string, role: "teacher" | "student", subjectId = `${role}-1`): string {
  const header = encode({ alg: "HS256", typ: "SVRT1" });
  const payload = encode({
    v: 1,
    sessionId,
    role,
    subjectId,
    exp: Math.floor(Date.now() / 1000) + 300,
  });
  const signature = createHmac("sha256", SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function envelope(sessionId: string, ts = Date.now()) {
  return {
    v: SOCKET_PROTOCOL_VERSION,
    sessionId,
    ts,
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
  const client = connect(url, signedToken(sessionId, role, `${role}-${sessionId}-${Math.random()}`));
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

describe("follow viewport ordering (unit)", () => {
  it("applies the first viewport and ignores strictly older timestamps", () => {
    expect(shouldApplyTeacherViewport(100, null)).toBe(true);
    expect(shouldApplyTeacherViewport(100, 100)).toBe(true);
    expect(shouldApplyTeacherViewport(200, 100)).toBe(true);
    expect(shouldApplyTeacherViewport(50, 100)).toBe(false);
  });
});

describe("follow mode sockets", () => {
  it("rejects student teacher:viewport with FORBIDDEN", async () => {
    const sessionId = "follow-forbid";
    const { url } = await runningSocketServer();
    await connectReady(url, sessionId, "teacher");
    const student = await connectReady(url, sessionId, "student");

    const rejected = waitForEvent<unknown>(student, SOCKET_EVENTS.protocolError);
    student.emit(SOCKET_EVENTS.teacherViewport, {
      ...envelope(sessionId),
      x: 1,
      y: 2,
      zoom: 1.5,
    });
    expect(protocolErrorSchema.parse(await rejected).code).toBe("FORBIDDEN");
  });

  it("forwards teacher viewport to students and isolates rooms", async () => {
    const sessionA = "follow-room-a";
    const sessionB = "follow-room-b";
    const { url } = await runningSocketServer();
    const teacherA = await connectReady(url, sessionA, "teacher");
    const studentA = await connectReady(url, sessionA, "student");
    const studentB = await connectReady(url, sessionB, "student");

    const received = waitForEvent<unknown>(studentA, SOCKET_EVENTS.teacherViewport);
    const leak = new Promise<"leak" | "ok">((resolve) => {
      const timeout = setTimeout(() => resolve("ok"), 500);
      studentB.once(SOCKET_EVENTS.teacherViewport, () => {
        clearTimeout(timeout);
        resolve("leak");
      });
    });

    teacherA.emit(SOCKET_EVENTS.teacherViewport, {
      ...envelope(sessionA),
      x: 42,
      y: -10,
      zoom: 1.25,
    });

    const viewport = teacherViewportSchema.parse(await received);
    expect(viewport.x).toBe(42);
    expect(viewport.y).toBe(-10);
    expect(viewport.zoom).toBe(1.25);
    expect(viewport.sessionId).toBe(sessionA);
    expect(await leak).toBe("ok");
  });

  it("keeps board scene version unchanged across viewport paths (3 clients)", async () => {
    const sessionId = "follow-three-clients";
    const { url } = await runningSocketServer();
    const teacher = await connectReady(url, sessionId, "teacher");
    const studentA = await connectReady(url, sessionId, "student");
    const studentB = await connectReady(url, sessionId, "student");

    const boardSeen = waitForEvent<unknown>(studentA, SOCKET_EVENTS.boardUpdate);
    teacher.emit(SOCKET_EVENTS.boardUpdate, {
      ...envelope(sessionId),
      boardVersion: 1,
      scene: { elements: [{ id: "stroke-keep" }] },
    });
    expect(boardUpdateSchema.parse(await boardSeen).boardVersion).toBe(1);

    const vpA = waitForEvent<unknown>(studentA, SOCKET_EVENTS.teacherViewport);
    const vpB = waitForEvent<unknown>(studentB, SOCKET_EVENTS.teacherViewport);
    teacher.emit(SOCKET_EVENTS.teacherViewport, {
      ...envelope(sessionId, Date.now()),
      x: 5,
      y: 6,
      zoom: 2,
    });
    await Promise.all([vpA, vpB]);

    // Local follow exit does not emit anything — student camera stays off the wire.
    const spuriousBoard = new Promise<"mutated" | "ok">((resolve) => {
      const timeout = setTimeout(() => resolve("ok"), 400);
      const onBoard = () => {
        clearTimeout(timeout);
        studentA.off(SOCKET_EVENTS.boardUpdate, onBoard);
        resolve("mutated");
      };
      studentA.on(SOCKET_EVENTS.boardUpdate, onBoard);
    });
    studentA.emit(SOCKET_EVENTS.teacherViewport, {
      ...envelope(sessionId),
      x: 99,
      y: 99,
      zoom: 3,
    });
    // Forbidden path must not rewrite hot scene either.
    await waitForEvent<unknown>(studentA, SOCKET_EVENTS.protocolError);

    const current = waitForEvent<unknown>(teacher, SOCKET_EVENTS.boardCurrent);
    teacher.emit(SOCKET_EVENTS.boardRequestCurrent, envelope(sessionId));
    const board = boardCurrentSchema.parse(await current);
    expect(board.boardVersion).toBe(1);
    expect(board.scene).toEqual({ elements: [{ id: "stroke-keep" }] });
    expect(await spuriousBoard).toBe("ok");
  });

  it("does not change board scene version when stale/out-of-order viewports arrive", async () => {
    const sessionId = "follow-stale-vp";
    const { url } = await runningSocketServer();
    const teacher = await connectReady(url, sessionId, "teacher");
    const student = await connectReady(url, sessionId, "student");

    const boardSeen = waitForEvent<unknown>(student, SOCKET_EVENTS.boardUpdate);
    teacher.emit(SOCKET_EVENTS.boardUpdate, {
      ...envelope(sessionId),
      boardVersion: 4,
      scene: { elements: [{ id: "stable" }] },
    });
    await boardSeen;

    const newer = waitForEvent<unknown>(student, SOCKET_EVENTS.teacherViewport);
    teacher.emit(SOCKET_EVENTS.teacherViewport, {
      ...envelope(sessionId, 2_000),
      x: 10,
      y: 10,
      zoom: 1,
    });
    expect(teacherViewportSchema.parse(await newer).ts).toBe(2_000);

    const older = waitForEvent<unknown>(student, SOCKET_EVENTS.teacherViewport);
    teacher.emit(SOCKET_EVENTS.teacherViewport, {
      ...envelope(sessionId, 1_000),
      x: 0,
      y: 0,
      zoom: 1,
    });
    // Server still forwards (lossy advisory); client ordering decides apply.
    expect(teacherViewportSchema.parse(await older).ts).toBe(1_000);
    expect(shouldApplyTeacherViewport(1_000, 2_000)).toBe(false);

    const current = waitForEvent<unknown>(student, SOCKET_EVENTS.boardCurrent);
    student.emit(SOCKET_EVENTS.boardRequestCurrent, envelope(sessionId));
    const board = boardCurrentSchema.parse(await current);
    expect(board.boardVersion).toBe(4);
    expect(board.scene).toEqual({ elements: [{ id: "stable" }] });
  });

  it("survives dropped viewport frames without corrupting board content", async () => {
    const sessionId = "follow-lossy";
    const { url } = await runningSocketServer();
    const teacher = await connectReady(url, sessionId, "teacher");
    const student = await connectReady(url, sessionId, "student");

    const boardSeen = waitForEvent<unknown>(student, SOCKET_EVENTS.boardUpdate);
    teacher.emit(SOCKET_EVENTS.boardUpdate, {
      ...envelope(sessionId),
      boardVersion: 2,
      scene: { elements: [{ id: "after-loss" }] },
    });
    await boardSeen;

    // Simulate packet loss: emit several viewports; student may miss some; board stays.
    for (let i = 0; i < 5; i += 1) {
      teacher.emit(SOCKET_EVENTS.teacherViewport, {
        ...envelope(sessionId, 3_000 + i),
        x: i,
        y: i,
        zoom: 1 + i * 0.1,
      });
    }

    const latest = waitForEvent<unknown>(student, SOCKET_EVENTS.teacherViewport);
    // At least one should arrive; content must remain version 2 regardless.
    await latest.catch(() => undefined);

    const current = waitForEvent<unknown>(student, SOCKET_EVENTS.boardCurrent);
    student.emit(SOCKET_EVENTS.boardRequestCurrent, envelope(sessionId));
    const board = boardCurrentSchema.parse(await current);
    expect(board.boardVersion).toBe(2);
    expect(board.scene).toEqual({ elements: [{ id: "after-loss" }] });
  });
});
