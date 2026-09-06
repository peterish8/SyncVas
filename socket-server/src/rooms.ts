/**
 * @scaffold true
 * @phase 3
 * Room join + coarse presence
 *
 * After token verify, socket.join(session:{id}); track coarse counts.
 * Publish room:presence; disconnect cleanup. Cross-room isolation tests in Phase 9.
 */

import type { Server, Socket } from "socket.io";

export function roomName(sessionId: string): string {
  return `session:${sessionId}`;
}

export function attachRoomHandlers(io: Server, socket: Socket): void {
  // PHASE 3: room:join with token; presence; leave on disconnect
  void io;
  void socket;
}
