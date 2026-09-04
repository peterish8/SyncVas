import type { Server as HttpServer } from "node:http";

import { Server } from "socket.io";

import {
  SOCKET_EVENTS,
  SOCKET_PROTOCOL_VERSION,
  foundationPingSchema,
} from "../../shared/protocol/socket.js";

export function createSocketServer(httpServer: HttpServer, allowedOrigins: string[]) {
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    // Milestone 0 exposes only a health check. Room-token authorization is required
    // before any classroom event family is introduced in Milestone 1.
    socket.on(SOCKET_EVENTS.foundationPing, (payload: unknown) => {
      const parsed = foundationPingSchema.safeParse(payload);
      if (!parsed.success) {
        return;
      }

      socket.emit(SOCKET_EVENTS.foundationPong, {
        v: SOCKET_PROTOCOL_VERSION,
        sentAt: parsed.data.sentAt,
        receivedAt: Date.now(),
      });
    });
  });

  return io;
}
