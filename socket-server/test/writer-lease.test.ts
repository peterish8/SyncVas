/**
 * Teacher writer lease: one writer socket per room.
 *
 * The lease exists so two different teachers can never both drive a board. It
 * must not lock out the *same* teacher whose reconnect (tab reload, network
 * flap) reaches the relay before the old socket's disconnect does — Socket.IO
 * never auto-reconnects after a server-side disconnect, so a rejection there
 * leaves the teacher offline for good.
 */
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";

import { io as createClient, type Socket as ClientSocket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";

import { SOCKET_EVENTS } from "../../shared/protocol/socket.js";
import { createSocketServer, mintRoomToken } from "../src/server.js";

const SECRET = "w".repeat(32);
const SESSION = "session-lease";
const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function startRelay(): Promise<{ port: number }> {
  const previousSecret = process.env.SOCKET_INTERNAL_SECRET;
  process.env.SOCKET_INTERNAL_SECRET = SECRET;
  const httpServer: HttpServer = createServer();
  const io = createSocketServer(httpServer, ["http://localhost:3000"], { unjoinedSocketGraceMs: 60_000 });
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

function connectTeacher(port: number, subjectId: string): ClientSocket {
  const client = createClient(`http://127.0.0.1:${port}`, {
    transports: ["websocket"],
    reconnection: false,
    auth: { token: mintRoomToken(SESSION, "teacher", subjectId, SECRET) },
  });
  cleanups.push(() => {
    client.disconnect();
  });
  return client;
}

function connected(client: ClientSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    client.once("connect", () => resolve());
    client.once("connect_error", reject);
  });
}

/** Resolve with the first protocol:error code, or null if none arrives in time. */
function firstErrorCode(client: ClientSocket, settleMs = 300): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), settleMs);
    client.once(SOCKET_EVENTS.protocolError, (payload: { code?: string }) => {
      clearTimeout(timer);
      resolve(payload?.code ?? "UNKNOWN");
    });
  });
}

function disconnectReason(client: ClientSocket, timeoutMs = 1_000): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    client.once("disconnect", (reason) => {
      clearTimeout(timer);
      resolve(reason);
    });
  });
}

describe("teacher writer lease", () => {
  it("lets the same teacher's new socket take over and tells the old one why", async () => {
    const { port } = await startRelay();
    const stale = connectTeacher(port, "teacher-a");
    await connected(stale);

    const staleError = firstErrorCode(stale, 1_000);
    const staleClosed = disconnectReason(stale);
    const fresh = connectTeacher(port, "teacher-a");
    const freshError = firstErrorCode(fresh);
    await connected(fresh);

    await expect(staleError).resolves.toBe("WRITER_REPLACED");
    await expect(staleClosed).resolves.toBe("io server disconnect");
    await expect(freshError).resolves.toBeNull();
    expect(fresh.connected).toBe(true);
  });

  it("keeps the lease on the new socket after the replaced socket disconnects", async () => {
    // The stale socket's disconnect handler must not release a lease that has
    // already moved, or a second teacher could slip in right after a takeover.
    const { port } = await startRelay();
    const stale = connectTeacher(port, "teacher-a");
    await connected(stale);
    const staleClosed = disconnectReason(stale);
    const fresh = connectTeacher(port, "teacher-a");
    await connected(fresh);
    await staleClosed;
    await new Promise((resolve) => setTimeout(resolve, 100));

    const intruder = connectTeacher(port, "teacher-b");
    await expect(firstErrorCode(intruder)).resolves.toBe("WRITER_ALREADY_ACTIVE");
    expect(fresh.connected).toBe(true);
  });

  it("still rejects a different teacher and leaves the writer alone", async () => {
    const { port } = await startRelay();
    const writer = connectTeacher(port, "teacher-a");
    await connected(writer);
    const writerError = firstErrorCode(writer);

    const other = connectTeacher(port, "teacher-b");
    const otherClosed = disconnectReason(other);
    await expect(firstErrorCode(other)).resolves.toBe("WRITER_ALREADY_ACTIVE");
    await expect(otherClosed).resolves.toBe("io server disconnect");
    await expect(writerError).resolves.toBeNull();
    expect(writer.connected).toBe(true);
  });

  it("releases the lease when the writer disconnects", async () => {
    const { port } = await startRelay();
    const writer = connectTeacher(port, "teacher-a");
    await connected(writer);
    writer.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 120));

    const next = connectTeacher(port, "teacher-b");
    await expect(firstErrorCode(next)).resolves.toBeNull();
    expect(next.connected).toBe(true);
  });
});
