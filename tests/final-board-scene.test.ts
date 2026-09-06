import { describe, expect, it } from "vitest";

import { serializeFinalBoardScene } from "@/lib/final-board-scene";

describe("serializeFinalBoardScene", () => {
  it("keeps the board scene and excludes transient browser file objects", () => {
    const fileLike = { id: "asset-1", dataURL: "data:image/svg+xml;base64,AAAA" };
    const serialized = serializeFinalBoardScene({
      elements: [{ id: "line-1", type: "line", x: 0, y: 0 }],
      appState: { viewBackgroundColor: "#fffefa", scrollX: 400 },
      files: { "asset-1": fileLike },
    });

    expect(JSON.parse(serialized)).toEqual({
      type: "excalidraw",
      elements: [{ id: "line-1", type: "line", x: 0, y: 0 }],
      appState: { viewBackgroundColor: "#fffefa" },
    });
  });

  it("creates a valid empty Excalidraw scene before the teacher makes a mark", () => {
    expect(JSON.parse(serializeFinalBoardScene(undefined))).toEqual({
      type: "excalidraw",
      elements: [],
      appState: {},
    });
  });
});