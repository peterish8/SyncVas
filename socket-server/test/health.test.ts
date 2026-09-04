import { createServer } from "node:http";

import { io as createClient } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";

import { SOCKET_EVENTS, SOCKET_PROTOCOL_VERSION, foundationPongSchema } from "../../shared/protocol/socket.js";
import { createSocketServer } from "../src/server.js";

describe("foundation socket service", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
  });

  it("answers a valid versioned health ping", async () => {
    const httpServer = createServer();
    const io = createSocketServer(httpServer, ["http://localhost:3000"]);

    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected a TCP address for the test socket server.");
    }

    cleanups.push(
      () => new Promise((resolve) => io.close(() => httpServer.close(() => resolve()))),
    );

    const client = createClient(`http://127.0.0.1:${address.port}`, {
      transports: ["websocket"],
    });
    cleanups.push(async () => {
      client.disconnect();
    });

    const pong = await new Promise<unknown>((resolve, reject) => {
      client.once("connect", () => {
        client.emit(SOCKET_EVENTS.foundationPing, { v: SOCKET_PROTOCOL_VERSION, sentAt: 42 });
      });
      client.once(SOCKET_EVENTS.foundationPong, resolve);
      client.once("connect_error", reject);
    });

    expect(foundationPongSchema.parse(pong)).toMatchObject({
      v: SOCKET_PROTOCOL_VERSION,
      sentAt: 42,
    });
  });
});
