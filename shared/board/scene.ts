/**
 * One scene-validation policy for every durable board write.
 *
 * Final snapshots (phase 6) and prepared templates (phase 11) persist the same
 * Excalidraw scene JSON, so they share these bounds rather than keeping a copy
 * each — two copies of a screening rule in this codebase have drifted before.
 */

/** Inline document bound. Convex documents are capped around 1 MB. */
export const MAX_SCENE_JSON_BYTES = 900_000;

export const MAX_TEMPLATE_TITLE_CHARS = 120;

export function sceneJsonByteLength(sceneJson: string): number {
  return new TextEncoder().encode(sceneJson).byteLength;
}

/**
 * Throws a stable, safe error code when the scene is unusable. Never echoes the
 * scene itself: the message reaches a client.
 */
export function validateSceneJson(sceneJson: string): void {
  if (sceneJsonByteLength(sceneJson) > MAX_SCENE_JSON_BYTES) {
    throw new Error("SCENE_TOO_LARGE: Final board scene is too large to persist.");
  }
  try {
    const parsed = JSON.parse(sceneJson) as { elements?: unknown };
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.elements)) throw new Error("invalid");
  } catch {
    throw new Error("INVALID_SCENE: Final board scene must be valid Excalidraw JSON.");
  }
}

/** Trims and bounds a teacher-supplied template title. */
export function normalizeTemplateTitle(title: string): string {
  const value = title.trim().replace(/\s+/gu, " ");
  if (!value) throw new Error("TITLE_REQUIRED: Give the template a name.");
  if (value.length > MAX_TEMPLATE_TITLE_CHARS) {
    throw new Error("TITLE_TOO_LONG: Keep the template name under 120 characters.");
  }
  return value;
}
