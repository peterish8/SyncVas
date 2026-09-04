import { createServer, type Server as HttpServer } from "node:http";

import { io as createClient, type Socket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";

import { createSocketServer } from "@/socket-server/src/server";
import {
  SOCKET_EVENTS,
  SOCKET_PROTOCOL_VERSION,
  boardCurrentSchema,
  boardUpdateSchema,
  protocolErrorSchema,
} from "@/shared/protocol/socket";

type Identity = { sessionId: string; role: "teacher" | "student" };

const envelope = (sessionId: string) => ({
  v: SOCKET_PROTOCOL_VERSION,
  sessionId,
  ts: Date.now(),
});

const TEACHER_PROOF_TOKEN = "phase2-test-teacher-token";

function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 1_500): Promise<T> {
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

async function startSocketService() {
  const httpServer = createServer();
  const io = createSocketServer(httpServer, ["http://localhost:3000"], { teacherProofToken: TEACHER_PROOF_TOKEN });
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();
  if (!address || typeof address === "string") throw new Error("Expected an ephemeral TCP address.");

  const clients: Socket[] = [];
  const connect = (identity: Identity) => {
    const socket = createClient(`http://127.0.0.1:${address.port}`, {
      transports: ["websocket"],
      auth: {
        ...identity,
        subjectId: `${identity.role}-${identity.sessionId}`,
        ...(identity.role === "teacher" ? { proofToken: TEACHER_PROOF_TOKEN } : {}),
      },
    });
    clients.push(socket);
    return new Promise<Socket>((resolve, reject) => {
      socket.once("connect", () => resolve(socket));
      socket.once("connect_error", reject);
    });
  };

  const close = async () => {
    clients.forEach((client) => client.disconnect());
    await new Promise<void>((resolve) => io.close(() => httpServer.close(() => resolve())));
  };

  return { connect, close };
}

describe("minimal board proof", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
  });

  it("broadcasts teacher scenes and rejects student board mutations", async () => {
    const service = await startSocketService();
    cleanups.push(service.close);
    const teacher = await service.connect({ sessionId: "sync-1", role: "teacher" });
    const student = await service.connect({ sessionId: "sync-1", role: "student" });

    const update = waitForEvent<unknown>(student, SOCKET_EVENTS.boardUpdate);
    teacher.emit(SOCKET_EVENTS.boardUpdate, {
      ...envelope("sync-1"),
      boardVersion: 1,
      scene: { elements: [{ id: "stroke-1" }] },
    });
    expect(boardUpdateSchema.parse(await update).boardVersion).toBe(1);

    const rejected = waitForEvent<unknown>(student, SOCKET_EVENTS.protocolError);
    student.emit(SOCKET_EVENTS.boardUpdate, {
      ...envelope("sync-1"),
      boardVersion: 2,
      scene: { elements: [{ id: "student-edit" }] },
    });
    expect(protocolErrorSchema.parse(await rejected).code).toBe("FORBIDDEN_BOARD_UPDATE");

    const current = waitForEvent<unknown>(student, SOCKET_EVENTS.boardCurrent);
    student.emit(SOCKET_EVENTS.boardRequestCurrent, envelope("sync-1"));
    expect(boardCurrentSchema.parse(await current).boardVersion).toBe(1);
  });

  it("bootstraps a late joiner with only the latest canonical scene", async () => {
    const service = await startSocketService();
    cleanups.push(service.close);
    const teacher = await service.connect({ sessionId: "sync-late", role: "teacher" });

    teacher.emit(SOCKET_EVENTS.boardUpdate, {
      ...envelope("sync-late"),
      boardVersion: 1,
      scene: { elements: [{ id: "old" }] },
    });
    teacher.emit(SOCKET_EVENTS.boardUpdate, {
      ...envelope("sync-late"),
      boardVersion: 2,
      scene: { elements: [{ id: "latest" }] },
    });

    const lateStudent = await service.connect({ sessionId: "sync-late", role: "student" });
    const current = waitForEvent<unknown>(lateStudent, SOCKET_EVENTS.boardCurrent);
    lateStudent.emit(SOCKET_EVENTS.boardRequestCurrent, envelope("sync-late"));
    const board = boardCurrentSchema.parse(await current);
    expect(board.boardVersion).toBe(2);
    expect(board.scene).toEqual({ elements: [{ id: "latest" }] });
  });

  it("rejects stale teacher versions without changing the canonical scene", async () => {
    const service = await startSocketService();
    cleanups.push(service.close);
    const teacher = await service.connect({ sessionId: "sync-stale", role: "teacher" });

    teacher.emit(SOCKET_EVENTS.boardUpdate, {
      ...envelope("sync-stale"),
      boardVersion: 3,
      scene: { elements: [{ id: "new" }] },
    });
    const rejected = waitForEvent<unknown>(teacher, SOCKET_EVENTS.protocolError);
    teacher.emit(SOCKET_EVENTS.boardUpdate, {
      ...envelope("sync-stale"),
      boardVersion: 2,
      scene: { elements: [{ id: "stale" }] },
    });
    expect(protocolErrorSchema.parse(await rejected).code).toBe("STALE_BOARD_VERSION");

    const current = waitForEvent<unknown>(teacher, SOCKET_EVENTS.boardCurrent);
    teacher.emit(SOCKET_EVENTS.boardRequestCurrent, envelope("sync-stale"));
    const board = boardCurrentSchema.parse(await current);
    expect(board.boardVersion).toBe(3);
    expect(board.scene).toEqual({ elements: [{ id: "new" }] });
  });

  it("does not let student navigation become a teacher viewport event", async () => {
    const service = await startSocketService();
    cleanups.push(service.close);
    const teacher = await service.connect({ sessionId: "sync-view", role: "teacher" });
    const student = await service.connect({ sessionId: "sync-view", role: "student" });
    const otherStudent = await service.connect({ sessionId: "sync-view", role: "student" });

    const rejected = waitForEvent<unknown>(student, SOCKET_EVENTS.protocolError);
    student.emit(SOCKET_EVENTS.teacherViewport, {
      ...envelope("sync-view"),
      x: 100,
      y: 200,
      zoom: 2,
    });
    expect(protocolErrorSchema.parse(await rejected).code).toBe("FORBIDDEN_VIEWPORT");

    const teacherViewport = waitForEvent<unknown>(otherStudent, SOCKET_EVENTS.teacherViewport);
    teacher.emit(SOCKET_EVENTS.teacherViewport, {
      ...envelope("sync-view"),
      x: 10,
      y: 20,
      zoom: 1.25,
    });
    expect((await teacherViewport as { x: number }).x).toBe(10);
  });
});
