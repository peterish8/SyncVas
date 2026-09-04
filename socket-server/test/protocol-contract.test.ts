import { describe, expect, it } from "vitest";

import {
  SOCKET_EVENTS,
  SOCKET_PROTOCOL_VERSION,
  boardUpdateSchema,
  teacherViewportSchema,
} from "../../shared/protocol/socket.js";

describe("shared protocol contract (NodeNext)", () => {
  it("resolves board and viewport validators with docs/11 event names", () => {
    expect(SOCKET_EVENTS.boardUpdate).toBe("board:update");
    expect(SOCKET_EVENTS.teacherViewport).toBe("teacher:viewport");

    const board = boardUpdateSchema.parse({
      v: SOCKET_PROTOCOL_VERSION,
      sessionId: "sess_contract",
      ts: 1_700_000_000_000,
      boardVersion: 1,
      scene: { elements: [] },
    });
    expect(board.boardVersion).toBe(1);

    const viewport = teacherViewportSchema.parse({
      v: SOCKET_PROTOCOL_VERSION,
      sessionId: "sess_contract",
      ts: 1_700_000_000_001,
      x: 0,
      y: 0,
      zoom: 1,
    });
    expect(viewport.zoom).toBe(1);
  });
});
