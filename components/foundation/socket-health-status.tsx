"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";

import { SOCKET_EVENTS, SOCKET_PROTOCOL_VERSION, foundationPongSchema } from "@/shared/protocol/socket";

type SocketState = "checking" | "ready" | "offline";

export function SocketHealthStatus() {
  const [state, setState] = useState<SocketState>("checking");

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4001", {
      reconnection: false,
      timeout: 3_000,
    });

    const timeout = window.setTimeout(() => {
      setState("offline");
      socket.disconnect();
    }, 3_500);

    socket.on("connect", () => {
      socket.emit(SOCKET_EVENTS.foundationPing, {
        v: SOCKET_PROTOCOL_VERSION,
        sentAt: Date.now(),
      });
    });

    socket.on(SOCKET_EVENTS.foundationPong, (payload: unknown) => {
      if (foundationPongSchema.safeParse(payload).success) {
        window.clearTimeout(timeout);
        setState("ready");
        socket.disconnect();
      }
    });

    socket.on("connect_error", () => {
      window.clearTimeout(timeout);
      setState("offline");
    });

    return () => {
      window.clearTimeout(timeout);
      socket.disconnect();
    };
  }, []);

  const ready = state === "ready";
  const copy = ready
    ? "Health ping responded from the local Socket.IO service."
    : state === "offline"
      ? "Service is not running. Start it with npm run dev:socket."
      : "Checking the local Socket.IO service…";

  return (
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className={`mt-1.5 size-2.5 shrink-0 rounded-full ${ready ? "bg-[#39A954]" : "bg-[#D7F500] ring-1 ring-black/15"}`} />
      <div>
        <p className="font-medium">Socket service</p>
        <p className="mt-1 text-sm leading-6 text-ink-muted">{copy}</p>
      </div>
    </div>
  );
}
