/**
 * In-memory latest scene per room.
 *
 * Keep only latest {version, scene} per sessionId while sockets connected.
 * Late join → board:current. Reconstructible from Convex snapshot after end.
 * Never write pointer streams to disk/DB from here.
 *
 * Both maps below are bounded by time. A room whose teacher simply closes the
 * tab never reaches `revokeRoom`, so without the idle sweep its scene (up to the
 * protocol ceiling, including binary files) would stay resident for the life of
 * the process.
 */

import { LIMITS } from "./config.js";

export type HotViewport = { x: number; y: number; zoom: number; pageId?: string; ts: number };
export type HotScene = { version: number; scene: unknown; files?: unknown; updatedAt: number; viewport?: HotViewport };

const rooms = new Map<string, HotScene>();
/** sessionId → time the room was revoked, so the tombstone can expire. */
const revokedRooms = new Map<string, number>();

export function getHotScene(sessionId: string): HotScene | undefined {
  return rooms.get(sessionId);
}

export function isRoomRevoked(sessionId: string): boolean {
  const revokedAt = revokedRooms.get(sessionId);
  if (revokedAt === undefined) return false;
  if (Date.now() - revokedAt > LIMITS.revokedRoomTtlMs) {
    revokedRooms.delete(sessionId);
    return false;
  }
  return true;
}

export function markRoomRevoked(sessionId: string): void {
  revokedRooms.set(sessionId, Date.now());
  rooms.delete(sessionId);
}

/**
 * Drop the least-recently-updated rooms until the map is back inside its cap.
 *
 * The idle sweep bounds how *long* a room is held; this bounds how *many* are
 * held at once, which is the dimension an abusive or bursty client actually
 * moves. Eviction is safe by construction: hot state is a cache in front of the
 * Convex snapshot, so an evicted room's next `board:update` simply repopulates
 * it, and the teacher's own client remains the authority on the live scene.
 */
function enforceRoomCap(): void {
  if (rooms.size <= LIMITS.maxHotRooms) return;
  const byOldest = [...rooms.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt);
  for (const [sessionId] of byOldest.slice(0, rooms.size - LIMITS.maxHotRooms)) {
    rooms.delete(sessionId);
  }
}

/** Accept only strictly newer versions; ignore equal/older. */
export function setHotScene(sessionId: string, next: HotScene): void {
  const prev = rooms.get(sessionId);
  if (prev && next.version <= prev.version) return;
  rooms.set(sessionId, next);
  enforceRoomCap();
}

export function setHotViewport(sessionId: string, viewport: HotViewport): void {
  const current = rooms.get(sessionId);
  if (!current) {
    rooms.set(sessionId, { version: 0, scene: {}, updatedAt: Date.now(), viewport });
    enforceRoomCap();
    return;
  }
  // Touch updatedAt so an actively-taught room is never swept mid-lesson, even
  // if the scene itself has not changed for a while.
  rooms.set(sessionId, { ...current, viewport, updatedAt: Date.now() });
}

export function clearHotScene(sessionId: string): void {
  rooms.delete(sessionId);
}

/**
 * Drop idle rooms and expired revocation tombstones.
 *
 * Returns the counts removed so the caller can log or assert on them.
 */
export function sweepHotState(now = Date.now()): { rooms: number; revoked: number } {
  let removedRooms = 0;
  for (const [sessionId, scene] of rooms) {
    if (now - scene.updatedAt > LIMITS.hotRoomIdleMs) {
      rooms.delete(sessionId);
      removedRooms += 1;
    }
  }
  let removedRevoked = 0;
  for (const [sessionId, revokedAt] of revokedRooms) {
    if (now - revokedAt > LIMITS.revokedRoomTtlMs) {
      revokedRooms.delete(sessionId);
      removedRevoked += 1;
    }
  }
  return { rooms: removedRooms, revoked: removedRevoked };
}

/** Observability for the health endpoint; contains no scene or student data. */
export function hotStateStats(): { rooms: number; revoked: number } {
  return { rooms: rooms.size, revoked: revokedRooms.size };
}

/** Test helper: wipe all in-memory hot scenes. */
export function resetHotState(): void {
  rooms.clear();
  revokedRooms.clear();
}
