/**
 * In-memory latest scene per room.
 *
 * Keep only latest {version, scene} per sessionId while sockets connected.
 * Late join → board:current. Reconstructible from Convex snapshot after end.
 * Never write pointer streams to disk/DB from here.
 */

export type HotViewport = { x: number; y: number; zoom: number; pageId?: string; ts: number };
export type HotScene = { version: number; scene: unknown; files?: unknown; updatedAt: number; viewport?: HotViewport };

const rooms = new Map<string, HotScene>();
const revokedRooms = new Set<string>();

export function getHotScene(sessionId: string): HotScene | undefined {
  return rooms.get(sessionId);
}

export function isRoomRevoked(sessionId: string): boolean {
  return revokedRooms.has(sessionId);
}

export function markRoomRevoked(sessionId: string): void {
  revokedRooms.add(sessionId);
  rooms.delete(sessionId);
}

/** Accept only strictly newer versions; ignore equal/older. */
export function setHotScene(sessionId: string, next: HotScene): void {
  const prev = rooms.get(sessionId);
  if (prev && next.version <= prev.version) return;
  rooms.set(sessionId, next);
}

export function setHotViewport(sessionId: string, viewport: HotViewport): void {
  const current = rooms.get(sessionId);
  if (!current) {
    rooms.set(sessionId, { version: 0, scene: {}, updatedAt: Date.now(), viewport });
    return;
  }
  rooms.set(sessionId, { ...current, viewport });
}

export function clearHotScene(sessionId: string): void {
  rooms.delete(sessionId);
}

/** Test helper: wipe all in-memory hot scenes. */
export function resetHotState(): void {
  rooms.clear();
  revokedRooms.clear();
}
