/**
 * Behavioural coverage for the relay's connection-level abuse controls.
 *
 * These are the paths that have no client UI and no Convex mutation behind them,
 * so a regression here is invisible until the process runs out of descriptors
 * mid-lesson. Each test drives the real Socket.IO server over a real TCP port
 * with the relevant cap overridden to a small number.
 */
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";

import { io as createClient, type Socket as ClientSocket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";

import { SOCKET_EVENTS, SOCKET_PROTOCOL_VERSION } from "../../shared/protocol/socket.js";
import type { LimitOverrides } from "../src/config.js";
import { createSocketServer, mintRoomToken } from "../src/server.js";

const SECRET = "z".repeat(32);
const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function startRelay(overrides: LimitOverrides): Promise<{ port: number }> {
  const previousSecret = process.env.SOCKET_INTERNAL_SECRET;
  process.env.SOCKET_INTERNAL_SECRET = SECRET;
  const httpServer: HttpServer = createServer();
  const io = createSocketServer(httpServer, ["http://localhost:3000"], overrides);
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address() as AddressInfo;
  cleanups.push(
    () =>
      new Promise<void>((resolve) => {
        io.close(() => httpServer.close(() => resolve()));
        if (previousSecret === undefined) delete process.env.SOCKET_INTERNAL_SECRET;
        else process.env.SOCKET_INTERNAL_SECRET = previousSecret;
      }),
  );
  return { port: address.port };
}

function connect(port: number, token?: string): ClientSocket {
  const client = createClient(`http://127.0.0.1:${port}`, {
    transports: ["websocket"],
    reconnection: false,
    ...(token ? { auth: { token } } : {}),
  });
  cleanups.push(() => {
    client.disconnect();
  });
  return client;
}

/** Resolve with the first protocol:error code, or null if the socket connects and stays up. */
function firstErrorCode(client: ClientSocket, settleMs = 300): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), settleMs);
    client.on(SOCKET_EVENTS.protocolError, (payload: { code?: string }) => {
      clearTimeout(timer);
      resolve(payload?.code ?? "UNKNOWN");
    });
  });
}

describe("tokenless connection budget", () => {
  it("refuses tokenless sockets past the per-address ceiling", async () => {
    // Tokenless sockets need no Convex-minted token, so they are the only way
    // onto this process without an admitted classroom. Two are allowed here;
    // the third must be told why it was closed rather than silently dropped.
    const { port } = await startRelay({ maxTokenlessSocketsPerIp: 2, unjoinedSocketGraceMs: 60_000 });

    const first = connect(port);
    const second = connect(port);
    await Promise.all([
      new Promise<void>((resolve) => first.once("connect", () => resolve())),
      new Promise<void>((resolve) => second.once("connect", () => resolve())),
    ]);

    const third = connect(port);
    await expect(firstErrorCode(third)).resolves.toBe("TOO_MANY_CONNECTIONS");
  });

  it("frees the budget again once a tokenless socket disconnects", async () => {
    // A cap that never decrements is a slow outage: the relay would refuse
    // health probes after enough of them had come and gone.
    const { port } = await startRelay({ maxTokenlessSocketsPerIp: 1, unjoinedSocketGraceMs: 60_000 });

    const first = connect(port);
    await new Promise<void>((resolve) => first.once("connect", () => resolve()));
    first.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 120));

    const second = connect(port);
    await expect(firstErrorCode(second)).resolves.toBeNull();
  });
});

describe("idle sockets that never join a room", () => {
  it("closes a socket that is still roomless after the grace period", async () => {
    const { port } = await startRelay({ unjoinedSocketGraceMs: 150 });
    const client = connect(port);
    await expect(firstErrorCode(client, 1_500)).resolves.toBe("IDLE_NO_ROOM");
  });

  it("leaves an admitted classroom socket alone", async () => {
    // The admitted path joins its room inside the connection handler, so the
    // idle timer must never fire for a real student.
    const { port } = await startRelay({ unjoinedSocketGraceMs: 150 });
    const token = mintRoomToken("session-idle", "student", "student-1", SECRET);
    const client = connect(port, token);
    await expect(firstErrorCode(client, 1_500)).resolves.toBeNull();
    expect(client.connected).toBe(true);
  });
});

describe("room:join amplification", () => {
  it("rate-limits repeated joins instead of re-broadcasting presence each time", async () => {
    // Each accepted join fans presence out to every socket in the room, so an
    // unrated loop turns one small frame into an N-socket broadcast.
    const { port } = await startRelay({ roomJoinPerMinute: 3, unjoinedSocketGraceMs: 60_000 });
    const token = mintRoomToken("session-join", "student", "student-1", SECRET);
    const client = connect(port, token);
    await new Promise<void>((resolve) => client.once("connect", () => resolve()));

    const codes: string[] = [];
    client.on(SOCKET_EVENTS.protocolError, (payload: { code?: string }) => {
      if (payload?.code) codes.push(payload.code);
    });
    for (let attempt = 0; attempt < 6; attempt += 1) {
      client.emit(SOCKET_EVENTS.roomJoin, {
        v: SOCKET_PROTOCOL_VERSION,
        sessionId: "session-join",
        ts: Date.now(),
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(codes).toContain("RATE_LIMITED");
  });
});

describe("presence broadcasts", () => {
  it("coalesces a burst of joins into at most one broadcast per interval", async () => {
    const { port } = await startRelay({
      presenceMinIntervalMs: 400,
      roomJoinPerMinute: 100,
      unjoinedSocketGraceMs: 60_000,
    });
    const token = mintRoomToken("session-presence", "student", "student-1", SECRET);
    const client = connect(port, token);
    await new Promise<void>((resolve) => client.once("connect", () => resolve()));

    let presenceFrames = 0;
    client.on(SOCKET_EVENTS.roomPresence, () => {
      presenceFrames += 1;
    });
    await new Promise((resolve) => setTimeout(resolve, 150));

    for (let attempt = 0; attempt < 10; attempt += 1) {
      client.emit(SOCKET_EVENTS.roomJoin, {
        v: SOCKET_PROTOCOL_VERSION,
        sessionId: "session-presence",
        ts: Date.now(),
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Ten joins inside one 400 ms window: the leading edge already fired during
    // admission, so the burst is entitled to a single trailing frame.
    expect(presenceFrames).toBeLessThanOrEqual(1);
  });
});
