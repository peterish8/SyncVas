/**
 * @phase 8
 * Export/history/reconnect
 *
 * export authz/status; empty history; reconnect resync; summary failure isolation.
 *
 * Non-negotiables: validate public args; ownership checks; indexed queries;
 * internal work via internal functions; never log raw doubt text/secrets.
 */

import { describe, expect, it } from "vitest";

import { getForSession, markFailed, markProcessing, markReady, request } from "@/convex/exports";
import { getLatestFinal, saveFinal } from "@/convex/boardSnapshots";
import { finalize, listTeacherHistory } from "@/convex/sessions";
import { createFakeConvex, handlerOf } from "./helpers/fake-convex";

const TEACHER = "users:owner";
const OTHER_TEACHER = "users:intruder";
const SESSION = "sessions:done";
const SNAPSHOT = "boardSnapshots:final";

const SCENE = JSON.stringify({ elements: [{ id: "a", type: "rectangle" }], appState: {} });

type SessionSeed = {
  status?: string;
  withSnapshot?: boolean;
  identity?: string;
};

function world(overrides?: SessionSeed) {
  const withSnapshot = overrides?.withSnapshot ?? true;
  return createFakeConvex({
    identity: { subject: overrides?.identity ?? "auth|owner" },
    seed: {
      users: [
        { _id: TEACHER, authSubject: "auth|owner", role: "teacher", createdAt: 1 },
        { _id: OTHER_TEACHER, authSubject: "auth|intruder", role: "teacher", createdAt: 1 },
      ],
      sessions: [
        {
          _id: SESSION,
          teacherId: TEACHER,
          title: "Quadratics",
          joinCode: "QN47XB",
          status: overrides?.status ?? "ended",
          latestBoardVersion: 4,
          startedAt: 10,
          ...(withSnapshot ? { latestSnapshotId: SNAPSHOT } : {}),
        },
      ],
      boardSnapshots: withSnapshot
        ? [
            {
              _id: SNAPSHOT,
              sessionId: SESSION,
              boardVersion: 4,
              sceneJsonCompressed: SCENE,
              kind: "final",
              createdAt: 20,
            },
          ]
        : [],
    },
  });
}

const requestExport = handlerOf<{ sessionId: string; type: string }, { exportId: string; status: string }>(request);
const listExports = handlerOf<{ sessionId: string }, Array<Record<string, unknown>>>(getForSession);
const beginExport = handlerOf<{ exportId: string }, Record<string, unknown> | null>(markProcessing);
const finishExport = handlerOf<{ exportId: string; storageId: string }, unknown>(markReady);
const failExport = handlerOf<{ exportId: string; errorCode: string }, unknown>(markFailed);
const history = handlerOf<Record<string, never>, Array<Record<string, unknown>>>(listTeacherHistory);
const finalizeSession = handlerOf<{ sessionId: string; attempt?: number }, { ok?: boolean; reason?: string } | null>(finalize);
const saveFinalBoard = handlerOf<{ sessionId: string; boardVersion: number; sceneJson: string }, unknown>(saveFinal);
const latestFinal = handlerOf<{ sessionId: string }, Record<string, unknown> | null>(getLatestFinal);

describe("EXP-01 export authorization", () => {
  it("refuses an export for a room the caller does not own", async () => {
    const intruder = world({ identity: "auth|intruder" });
    await expect(requestExport(intruder.ctx, { sessionId: SESSION, type: "board-pdf" })).rejects.toThrow(
      /Classroom not found/,
    );
    expect(intruder.rows("exports")).toHaveLength(0);
  });

  it("refuses to list another teacher's export jobs", async () => {
    const intruder = world({ identity: "auth|intruder" });
    await expect(listExports(intruder.ctx, { sessionId: SESSION })).rejects.toThrow(/Classroom not found/);
  });

  it("refuses an export before the class has ended", async () => {
    const live = world({ status: "live" });
    await expect(requestExport(live.ctx, { sessionId: SESSION, type: "board-pdf" })).rejects.toThrow(
      /FINAL_BOARD_REQUIRED/,
    );
  });

  it("refuses an export when the room ended without a final board", async () => {
    const noSnapshot = world({ withSnapshot: false });
    await expect(requestExport(noSnapshot.ctx, { sessionId: SESSION, type: "png" })).rejects.toThrow(
      /FINAL_BOARD_REQUIRED/,
    );
  });
});

describe("EXP-02 export job status", () => {
  it("queues a job for the owner and schedules exactly one worker run", async () => {
    const fake = world();
    const result = await requestExport(fake.ctx, { sessionId: SESSION, type: "board-pdf" });

    expect(result.status).toBe("queued");
    expect(fake.rows("exports")).toHaveLength(1);
    expect(fake.scheduled).toHaveLength(1);
    expect(fake.scheduled[0].args).toMatchObject({ exportId: result.exportId });
  });

  it("advances queued to processing to ready", async () => {
    const fake = world();
    const { exportId } = await requestExport(fake.ctx, { sessionId: SESSION, type: "png" });

    await beginExport(fake.ctx, { exportId });
    expect(fake.rows("exports")[0].status).toBe("processing");

    await finishExport(fake.ctx, { exportId, storageId: "_storage:1" });
    expect(fake.rows("exports")[0].status).toBe("ready");
    expect(fake.rows("exports")[0].storageId).toBe("_storage:1");
    expect(fake.rows("exports")[0].completedAt).toBeTypeOf("number");
  });

  it("does not reprocess a job that already left the queue", async () => {
    const fake = world();
    const { exportId } = await requestExport(fake.ctx, { sessionId: SESSION, type: "png" });

    await beginExport(fake.ctx, { exportId });
    // A duplicate worker run must be a no-op rather than a second attempt.
    await expect(beginExport(fake.ctx, { exportId })).resolves.toBeNull();
    expect(fake.rows("exports")[0].status).toBe("processing");
  });

  it("records a failure as a terminal state with a safe error code", async () => {
    const fake = world();
    const { exportId } = await requestExport(fake.ctx, { sessionId: SESSION, type: "notes-pdf" });

    await beginExport(fake.ctx, { exportId });
    await failExport(fake.ctx, { exportId, errorCode: "EXPORT_GENERATION_FAILED" });

    const job = fake.rows("exports")[0];
    expect(job.status).toBe("failed");
    expect(job.errorCode).toBe("EXPORT_GENERATION_FAILED");
    // The code is an identifier, not an internal message.
    expect(String(job.errorCode)).not.toMatch(/stack|Error:|at /iu);
  });
});

describe("HIST-01 teacher history", () => {
  it("returns an empty list when the teacher has no ended classes", async () => {
    const live = world({ status: "live" });
    await expect(history(live.ctx, {})).resolves.toEqual([]);
  });

  it("lists only the calling teacher's ended classes", async () => {
    const fake = world();
    fake.rows("sessions").push({
      _id: "sessions:other-teacher",
      _creationTime: 30,
      teacherId: OTHER_TEACHER,
      title: "Someone else",
      joinCode: "ZZ11XX",
      status: "ended",
      latestBoardVersion: 1,
    });

    const rows = await history(fake.ctx, {});
    expect(rows).toHaveLength(1);
    expect(rows[0]._id).toBe(SESSION);
  });

  it("excludes rooms that are still live or mid-ending", async () => {
    const fake = world();
    for (const status of ["live", "ending", "draft"]) {
      fake.rows("sessions").push({
        _id: `sessions:${status}`,
        _creationTime: 40,
        teacherId: TEACHER,
        title: status,
        joinCode: "AA22BB",
        status,
        latestBoardVersion: 0,
      });
    }
    const rows = await history(fake.ctx, {});
    expect(rows.map((row) => row._id)).toEqual([SESSION]);
  });
});

describe("FIN-01 finalization protects the durable board", () => {
  it("reschedules itself rather than ending while no final board exists", async () => {
    const fake = world({ status: "ending", withSnapshot: false });
    const result = await finalizeSession(fake.ctx, { sessionId: SESSION });

    expect(result).toMatchObject({ ok: false, reason: "FINAL_SNAPSHOT_PENDING" });
    expect(fake.rows("sessions")[0].status).toBe("ending");
    // The only thing scheduled is the retry; the summary stays downstream of a
    // durable board.
    expect(fake.scheduled).toHaveLength(1);
  });

  it("still terminates the room after the retries are spent, flagging the lost board", async () => {
    const fake = world({ status: "ending", withSnapshot: false });
    const result = await finalizeSession(fake.ctx, { sessionId: SESSION, attempt: 4 });

    expect(result).toMatchObject({ ok: false, reason: "FINAL_SNAPSHOT_MISSING" });
    expect(fake.rows("sessions")[0].status).toBe("ended");
    expect(fake.rows("sessions")[0].finalizeWarning).toBe("FINAL_SNAPSHOT_MISSING");
    // No summary: there is no board to summarize.
    expect(fake.scheduled).toHaveLength(0);
  });

  it("ends the room and schedules the summary only after the board is durable", async () => {
    const fake = world({ status: "ending" });
    const result = await finalizeSession(fake.ctx, { sessionId: SESSION });

    expect(result).toMatchObject({ ok: true });
    expect(fake.rows("sessions")[0].status).toBe("ended");
    expect(fake.rows("sessions")[0].endedAt).toBeTypeOf("number");
    expect(fake.scheduled).toHaveLength(1);
  });

  it("keeps the summary strictly downstream so it cannot unwind the ended board", async () => {
    const fake = world({ status: "ending" });
    await finalizeSession(fake.ctx, { sessionId: SESSION });
    // The notes job is scheduled, never awaited inside finalization.
    expect(fake.rows("sessions")[0].status).toBe("ended");
    expect(fake.scheduled[0].delayMs).toBe(0);
  });

  it("is idempotent for a room that already ended", async () => {
    const fake = world({ status: "ended" });
    await expect(finalizeSession(fake.ctx, { sessionId: SESSION })).resolves.toBeNull();
  });
});

describe("RECON-01 the final board survives and is recoverable", () => {
  it("stores the exact scene the teacher last published", async () => {
    const fake = world({ status: "live", withSnapshot: false });
    await saveFinalBoard(fake.ctx, { sessionId: SESSION, boardVersion: 7, sceneJson: SCENE });

    const snapshot = await latestFinal(fake.ctx, { sessionId: SESSION });
    expect(snapshot?.sceneJsonCompressed).toBe(SCENE);
    expect(fake.rows("sessions")[0].latestSnapshotId).toBe(snapshot?._id);
    expect(fake.rows("sessions")[0].latestBoardVersion).toBe(7);
  });

  it("overwrites rather than duplicates when the same version is saved twice", async () => {
    const fake = world({ status: "live", withSnapshot: false });
    await saveFinalBoard(fake.ctx, { sessionId: SESSION, boardVersion: 7, sceneJson: SCENE });

    const revised = JSON.stringify({ elements: [{ id: "b", type: "ellipse" }], appState: {} });
    await saveFinalBoard(fake.ctx, { sessionId: SESSION, boardVersion: 7, sceneJson: revised });

    expect(fake.rows("boardSnapshots")).toHaveLength(1);
    expect(fake.rows("boardSnapshots")[0].sceneJsonCompressed).toBe(revised);
  });

  it("refuses a scene that is not valid Excalidraw JSON", async () => {
    const fake = world({ status: "live", withSnapshot: false });
    await expect(
      saveFinalBoard(fake.ctx, { sessionId: SESSION, boardVersion: 1, sceneJson: "not json" }),
    ).rejects.toThrow(/INVALID_SCENE/);
    expect(fake.rows("boardSnapshots")).toHaveLength(0);
  });

  it("refuses an oversized scene rather than truncating the board", async () => {
    const fake = world({ status: "live", withSnapshot: false });
    const huge = JSON.stringify({ elements: [{ id: "x", pad: "y".repeat(1_000_000) }] });
    await expect(
      saveFinalBoard(fake.ctx, { sessionId: SESSION, boardVersion: 1, sceneJson: huge }),
    ).rejects.toThrow(/SCENE_TOO_LARGE/);
  });

  it("refuses a snapshot for a room that is no longer live", async () => {
    const fake = world({ status: "ended" });
    await expect(
      saveFinalBoard(fake.ctx, { sessionId: SESSION, boardVersion: 9, sceneJson: SCENE }),
    ).rejects.toThrow(/SESSION_NOT_LIVE/);
  });

  it("refuses a negative or fractional board version", async () => {
    const fake = world({ status: "live", withSnapshot: false });
    for (const boardVersion of [-1, 1.5]) {
      await expect(
        saveFinalBoard(fake.ctx, { sessionId: SESSION, boardVersion, sceneJson: SCENE }),
      ).rejects.toThrow(/INVALID_BOARD_VERSION/);
    }
  });
});
