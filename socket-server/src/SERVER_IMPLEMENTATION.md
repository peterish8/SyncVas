# socket-server/src/server.ts — implementation map

Phase 1 (done): foundation ping/pong only.

Phase 2: call `attachClassroomHandlers` for board:update / request-current; use `board-hot-state`.

Phase 3: handshake auth via `verifyRoomToken`; `attachRoomHandlers`; no spoofable role.

Phase 4: viewport forward in protocol handlers.

Phase 6: on end, allow one snapshot pull for finalization; clear hot state when appropriate.

Phase 8: reconnect clients re-auth + request current.

Phase 9: permission/cross-room adversarial coverage against this server.
