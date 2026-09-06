/**
 * Produces the durable portion of an Excalidraw scene.
 *
 * Binary assets follow a separate transport/storage path. A final snapshot must
 * never silently stringify browser File objects, because doing so creates an
 * unusable scene reference.
 */
export function serializeFinalBoardScene(scene: unknown): string {
  const source = scene && typeof scene === "object" ? (scene as Record<string, unknown>) : {};
  const appState = source.appState && typeof source.appState === "object"
    ? (source.appState as Record<string, unknown>)
    : {};

  return JSON.stringify({
    type: "excalidraw",
    elements: Array.isArray(source.elements) ? source.elements : [],
    appState:
      typeof appState.viewBackgroundColor === "string"
        ? { viewBackgroundColor: appState.viewBackgroundColor }
        : {},
  });
}