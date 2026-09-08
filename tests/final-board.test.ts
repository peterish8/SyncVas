/**
 * @phase 6
 * Final board persistence — EXPORT-01
 *
 * Finalize ownership; no pen streams; restore after refresh; idempotent finalize.
 *
 * Non-negotiables: validate public args; ownership checks; indexed queries;
 * internal work via internal functions; never log raw doubt text/secrets.
 */

import { describe, expect, it } from "vitest";

import { getLatestFinal, saveFinal } from "@/convex/boardSnapshots";
import { finalize, saveFinalAndEnd } from "@/convex/sessions";
import { createFakeConvex, handlerOf } from "./helpers/fake-convex";

const TEACHER = "users:owner";
const SESSION = "sessions:live";

const SCENE = JSON.stringify({
  type: "excalidraw",
  version: 2,
  elements: [{ id: "el-1", type: "freedraw", x: 10, y: 12, points: [[0, 0], [4, 6]] }],
  appState: { viewBackgroundColor: "#ffffff" },
});

function world(sessionStatus: "live" | "ending" | "ended" = "live", extra?: Record<string, unknown>) {
  return createFakeConvex({
    identity: { subject: "auth|owner" },
    seed: {
      users: [{ _id: TEACHER, authSubject: "auth|owner", role: "teacher", createdAt: 1 }],
      sessions: [
        {
          _id: SESSION,
          teacherId: TEACHER,
          title: "Quadratics",
          joinCode: "QN47XB",
          status: sessionStatus,
          latestBoardVersion: 0,
          ...extra,
        },
      ],
    },
  });
}

const save = handlerOf<{ sessionId: string; boardVersion: number; sceneJson: string }, { snapshotId: string; boardVersion: number }>(saveFinal);
const latest = handlerOf<{ sessionId: string }, Record<string, unknown> | null>(getLatestFinal);
const runFinalize = handlerOf<
  { sessionId: string; attempt?: number },
  { ok: boolean; reason?: string; endedAt?: number } | null
>(finalize);

describe("EXPORT-01 durable final scene", () => {
  it("persists the final scene and points the session at it", async () => {
    const fake = world("ending");
    const result = await save(fake.ctx, { sessionId: SESSION, boardVersion: 24, sceneJson: SCENE });

    expect(result.boardVersion).toBe(24);
    const snapshots = fake.rows("boardSnapshots");
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].kind).toBe("final");
    expect(snapshots[0].sceneJsonCompressed).toBe(SCENE);

    const session = fake.rows("sessions")[0];
    expect(session.latestSnapshotId).toBe(result.snapshotId);
    expect(session.latestBoardVersion).toBe(24);
  });

  it("survives a reopen: the owner reads the same scene back", async () => {
    const fake = world("ending");
    await save(fake.ctx, { sessionId: SESSION, boardVersion: 24, sceneJson: SCENE });
    const restored = await latest(fake.ctx, { sessionId: SESSION });
    expect(restored?.sceneJsonCompressed).toBe(SCENE);
  });

  it("is idempotent for the same board version", async () => {
    const fake = world("ending");
    const first = await save(fake.ctx, { sessionId: SESSION, boardVersion: 24, sceneJson: SCENE });
    const second = await save(fake.ctx, { sessionId: SESSION, boardVersion: 24, sceneJson: SCENE });

    expect(second.snapshotId).toBe(first.snapshotId);
    expect(fake.rows("boardSnapshots")).toHaveLength(1);
  });

  it("persists no raw pen/pointer stream alongside the scene", async () => {
    const fake = world("ending");
    await save(fake.ctx, { sessionId: SESSION, boardVersion: 24, sceneJson: SCENE });
    const snapshot = fake.rows("boardSnapshots")[0];

    for (const forbidden of ["pointerEvents", "strokes", "penEvents", "events", "pointerStream"]) {
      expect(Object.keys(snapshot)).not.toContain(forbidden);
    }
    // The only scene payload is the single serialized Excalidraw document.
    expect(typeof snapshot.sceneJsonCompressed).toBe("string");
  });
});

describe("EXPORT-01 validation and ownership", () => {
  it("rejects a scene that is not Excalidraw JSON", async () => {
    const fake = world("ending");
    await expect(
      save(fake.ctx, { sessionId: SESSION, boardVersion: 1, sceneJson: "{\"nope\":true}" }),
    ).rejects.toThrow("INVALID_SCENE");
    await expect(
      save(fake.ctx, { sessionId: SESSION, boardVersion: 1, sceneJson: "not json at all" }),
    ).rejects.toThrow("INVALID_SCENE");
  });

  it("rejects an oversized scene rather than truncating it", async () => {
    const fake = world("ending");
    const huge = JSON.stringify({ elements: [{ id: "x", blob: "y".repeat(1_000_000) }] });
    await expect(
      save(fake.ctx, { sessionId: SESSION, boardVersion: 1, sceneJson: huge }),
    ).rejects.toThrow("SCENE_TOO_LARGE");
  });

  it("rejects a negative or fractional board version", async () => {
    const fake = world("ending");
    await expect(save(fake.ctx, { sessionId: SESSION, boardVersion: -1, sceneJson: SCENE })).rejects.toThrow("INVALID_BOARD_VERSION");
    await expect(save(fake.ctx, { sessionId: SESSION, boardVersion: 1.5, sceneJson: SCENE })).rejects.toThrow("INVALID_BOARD_VERSION");
  });

  it("refuses a final save once the room has already ended", async () => {
    const fake = world("ended");
    await expect(save(fake.ctx, { sessionId: SESSION, boardVersion: 1, sceneJson: SCENE })).rejects.toThrow("SESSION_NOT_LIVE");
  });

  it("refuses a final save from a teacher who does not own the room", async () => {
    const intruder = createFakeConvex({
      identity: { subject: "auth|intruder" },
      seed: {
        users: [{ _id: "users:intruder", authSubject: "auth|intruder", role: "teacher", createdAt: 1 }],
        sessions: [{ _id: SESSION, teacherId: TEACHER, title: "Quadratics", joinCode: "QN47XB", status: "ending", latestBoardVersion: 0 }],
      },
    });
    await expect(save(intruder.ctx, { sessionId: SESSION, boardVersion: 1, sceneJson: SCENE })).rejects.toThrow("Classroom not found");
  });
});

describe("EXPORT-01 finalization", () => {
  it("marks the room ended once a final snapshot exists", async () => {
    const fake = world("ending");
    const { snapshotId } = await save(fake.ctx, { sessionId: SESSION, boardVersion: 24, sceneJson: SCENE });
    void snapshotId;

    const result = await runFinalize(fake.ctx, { sessionId: SESSION });
    expect(result?.ok).toBe(true);
    const session = fake.rows("sessions")[0];
    expect(session.status).toBe("ended");
    expect(typeof session.endedAt).toBe("number");
  });

  it("retries rather than ending while the final snapshot may still be in flight", async () => {
    const fake = world("ending");
    const result = await runFinalize(fake.ctx, { sessionId: SESSION });

    expect(result).toMatchObject({ ok: false, reason: "FINAL_SNAPSHOT_PENDING" });
    expect(fake.rows("sessions")[0].status).toBe("ending");
  });

  it("completes normally when a retry finds the snapshot has landed", async () => {
    const fake = world("ending");
    expect(await runFinalize(fake.ctx, { sessionId: SESSION })).toMatchObject({ reason: "FINAL_SNAPSHOT_PENDING" });

    await save(fake.ctx, { sessionId: SESSION, boardVersion: 7, sceneJson: SCENE });
    const result = await runFinalize(fake.ctx, { sessionId: SESSION, attempt: 1 });

    expect(result?.ok).toBe(true);
    expect(fake.rows("sessions")[0].status).toBe("ended");
    expect(fake.rows("sessions")[0].finalizeWarning).toBeUndefined();
  });

  /**
   * The room must always terminate. `end` has already revoked every socket and
   * cleared relay hot state, so a session parked in `ending` can never be
   * re-saved, re-ended or exported — the class is unrecoverable. Losing the
   * board is bad; silently stranding the room is worse.
   */
  it("ends the room with a warning once the retries are spent", async () => {
    const fake = world("ending");
    const result = await runFinalize(fake.ctx, { sessionId: SESSION, attempt: 4 });

    expect(result).toMatchObject({ ok: false, reason: "FINAL_SNAPSHOT_MISSING" });
    const session = fake.rows("sessions")[0];
    expect(session.status).toBe("ended");
    expect(session.finalizeWarning).toBe("FINAL_SNAPSHOT_MISSING");
    expect(typeof session.endedAt).toBe("number");
  });

  it("is a no-op when the room is not in the ending state", async () => {
    const fake = world("live");
    await expect(runFinalize(fake.ctx, { sessionId: SESSION })).resolves.toBeNull();
    expect(fake.rows("sessions")[0].status).toBe("live");
  });

  it("can be re-run after a completed finalization without duplicating the end", async () => {
    const fake = world("ending");
    await save(fake.ctx, { sessionId: SESSION, boardVersion: 24, sceneJson: SCENE });
    const first = await runFinalize(fake.ctx, { sessionId: SESSION });
    const endedAt = fake.rows("sessions")[0].endedAt;

    const second = await runFinalize(fake.ctx, { sessionId: SESSION });
    expect(first?.ok).toBe(true);
    expect(second).toBeNull();
    expect(fake.rows("sessions")[0].endedAt).toBe(endedAt);
  });
});

/**
 * The save-then-end sequence left a window: if the tab closed, the network
 * dropped, or the scene exceeded the persistence bound between the two calls,
 * the room reached `ending` with no board — and finalization then had nothing to
 * work with. Convex mutations are transactional, so both happen or neither does.
 */
describe("FIN-02 atomic save-and-end", () => {
  const saveAndEnd = handlerOf<
    { sessionId: string; boardVersion: number; sceneJson: string },
    { status: string; snapshotId?: string }
  >(saveFinalAndEnd);

  it("persists the board and begins ending in one call", async () => {
    const fake = world("live");
    const result = await saveAndEnd(fake.ctx, { sessionId: SESSION, boardVersion: 12, sceneJson: SCENE });

    expect(result.status).toBe("ending");
    const session = fake.rows("sessions")[0];
    expect(session.status).toBe("ending");
    expect(session.latestSnapshotId).toBeDefined();
    expect(fake.rows("boardSnapshots")[0].sceneJsonCompressed).toBe(SCENE);
  });

  it("leaves the room live when the scene cannot be persisted", async () => {
    const fake = world("live");
    const oversized = JSON.stringify({ elements: [{ id: "x", note: "z".repeat(1_000_000) }] });

    await expect(
      saveAndEnd(fake.ctx, { sessionId: SESSION, boardVersion: 1, sceneJson: oversized }),
    ).rejects.toThrow("SCENE_TOO_LARGE");
    // The whole point: a failed save must not have half-ended the room.
    expect(fake.rows("sessions")[0].status).toBe("live");
    expect(fake.rows("boardSnapshots")).toHaveLength(0);
  });

  it("refuses a teacher who does not own the room", async () => {
    const intruder = createFakeConvex({
      identity: { subject: "auth|intruder" },
      seed: {
        users: [{ _id: "users:intruder", authSubject: "auth|intruder", role: "teacher", createdAt: 1 }],
        sessions: [{ _id: SESSION, teacherId: TEACHER, title: "Quadratics", joinCode: "QN47XB", status: "live", latestBoardVersion: 0 }],
      },
    });
    await expect(
      saveAndEnd(intruder.ctx, { sessionId: SESSION, boardVersion: 1, sceneJson: SCENE }),
    ).rejects.toThrow("Classroom not found");
  });

  it("is idempotent against a double click", async () => {
    const fake = world("live");
    await saveAndEnd(fake.ctx, { sessionId: SESSION, boardVersion: 12, sceneJson: SCENE });
    const second = await saveAndEnd(fake.ctx, { sessionId: SESSION, boardVersion: 12, sceneJson: SCENE });

    expect(second.status).toBe("ending");
    expect(fake.rows("boardSnapshots")).toHaveLength(1);
  });
});
