import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { io as createClient, type Socket } from "socket.io-client";
import { createSocketServer, mintRoomToken } from "@/socket-server/src/server";
import { SOCKET_EVENTS, SOCKET_PROTOCOL_VERSION } from "@/shared/protocol/socket";

describe("LOAD-01 bounded viewer smoke", () => {
  let ioServer: ReturnType<typeof createSocketServer> | null = null;
  let httpServer: ReturnType<typeof createServer> | null = null;
  const clients: Socket[] = [];

  afterEach(async () => {
    clients.forEach((client) => client.disconnect());
    ioServer?.close();
    if (httpServer?.listening) await new Promise<void>((resolve) => httpServer?.close(() => resolve()));
    ioServer = null; httpServer = null;
  });

  it("connects one teacher and 100 viewers, then broadcasts one scene", async () => {
    const secret = "load-smoke-secret-that-is-at-least-32-bytes";
    process.env.SOCKET_INTERNAL_SECRET = secret;
    httpServer = createServer();
    ioServer = createSocketServer(httpServer, ["http://localhost:3000"]);
    await new Promise<void>((resolve) => httpServer?.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("Expected test port.");
    const url = `http://127.0.0.1:${address.port}`;
    const sessionId = "load-room";
    const teacher = createClient(url, { transports: ["websocket"], auth: { token: mintRoomToken(sessionId, "teacher", "teacher", secret) } });
    clients.push(teacher);
    await new Promise<void>((resolve, reject) => { teacher.once("connect", () => resolve()); teacher.once("connect_error", reject); });
    let received = 0;
    const viewers = Array.from({ length: 100 }, (_, index) => {
      const viewer = createClient(url, { transports: ["websocket"], auth: { token: mintRoomToken(sessionId, "student", `viewer-${index}`, secret) } });
      viewer.on(SOCKET_EVENTS.boardUpdate, () => { received += 1; });
      clients.push(viewer);
      return viewer;
    });
    await Promise.all(viewers.map((viewer) => new Promise<void>((resolve, reject) => { viewer.once("connect", () => resolve()); viewer.once("connect_error", reject); })));
    teacher.emit(SOCKET_EVENTS.boardUpdate, { v: SOCKET_PROTOCOL_VERSION, sessionId, ts: Date.now(), boardVersion: 1, scene: { elements: [{ id: "load" }] } });
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(received).toBe(100);
  }, 15_000);
});
