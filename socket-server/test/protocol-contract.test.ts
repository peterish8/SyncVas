import { describe, expect, it } from "vitest";

import {
  SOCKET_EVENTS,
  SOCKET_PROTOCOL_VERSION,
  boardUpdateSchema,
  boardCurrentSchema,
  teacherViewportSchema,
  blockHighlightSchema,
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

    const current = boardCurrentSchema.parse({
      v: SOCKET_PROTOCOL_VERSION,
      sessionId: "sess_contract",
      ts: 1_700_000_000_002,
      boardVersion: 1,
      scene: { elements: [] },
      teacherViewport: { ...viewport, ts: 1_700_000_000_002 },
    });
    expect(current.teacherViewport?.zoom).toBe(1);

    const highlight = blockHighlightSchema.parse({
      v: SOCKET_PROTOCOL_VERSION,
      sessionId: "sess_contract",
      ts: 1_700_000_000_003,
      blockId: "code-1",
      startLine: 3,
      endLine: 5,
    });
    expect(highlight.endLine).toBe(5);
    expect(() => blockHighlightSchema.parse({ ...highlight, startLine: 0 })).toThrow();
  });
});
