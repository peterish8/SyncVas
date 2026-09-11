import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

import {
  TRANSIENT_SYNC_ERROR_TTL_MS,
  classifySyncError,
  extractSyncErrorCode,
  isClassEndedError,
} from "@/lib/board-sync-errors";
import { boardSyncStatusLabel, toUserFacingError } from "@/lib/user-facing-errors";

describe("classifySyncError", () => {
  it("treats a revoked room and an ended session as terminal", () => {
    expect(classifySyncError("ROOM_REVOKED")).toBe("ended");
    expect(classifySyncError("SESSION_ENDED")).toBe("ended");
    expect(classifySyncError("SESSION_NOT_LIVE")).toBe("ended");
  });

  it("treats single refused frames as transient", () => {
    for (const code of ["RATE_LIMITED", "STALE_BOARD_VERSION", "INVALID_PAYLOAD", "TOKEN_EXPIRED", "PAYLOAD_TOO_LARGE"]) {
      expect(classifySyncError(code)).toBe("transient");
    }
  });

  it("keeps connection-level refusals persistent", () => {
    for (const code of [
      "UNAUTHORIZED",
      "ROOM_MISMATCH",
      "ROOM_FULL",
      "TOO_MANY_CONNECTIONS",
      "IDLE_NO_ROOM",
      "WRITER_ALREADY_ACTIVE",
      "WRITER_REPLACED",
      "FORBIDDEN",
      "STUDENT_BOARD_EDIT_FORBIDDEN",
      "SOMETHING_NEW",
      "",
    ]) {
      expect(classifySyncError(code)).toBe("persistent");
    }
  });

  it("exposes a positive TTL for transient errors", () => {
    expect(TRANSIENT_SYNC_ERROR_TTL_MS).toBe(6000);
  });
});

describe("extractSyncErrorCode", () => {
  it("reads the code from a ConvexError payload", () => {
    const error = new ConvexError({ code: "SESSION_ENDED", message: "This room is not accepting joins." });
    expect(extractSyncErrorCode(error)).toBe("SESSION_ENDED");
    expect(isClassEndedError(error)).toBe(true);
  });

  it("reads CODE: detail strings and bare handshake codes", () => {
    expect(extractSyncErrorCode(new Error("RATE_LIMITED: slow down"))).toBe("RATE_LIMITED");
    expect(extractSyncErrorCode(new Error("UNAUTHORIZED"))).toBe("UNAUTHORIZED");
    expect(extractSyncErrorCode("ROOM_REVOKED")).toBe("ROOM_REVOKED");
  });

  it("returns null for prose and for production-stripped errors", () => {
    expect(extractSyncErrorCode(new Error("Server Error"))).toBeNull();
    expect(extractSyncErrorCode(new Error("Socket connection failed."))).toBeNull();
    expect(extractSyncErrorCode(null)).toBeNull();
    expect(isClassEndedError(new Error("Server Error"))).toBe(false);
  });
});

describe("user-facing copy for the new sync states", () => {
  it("labels the ended status", () => {
    expect(boardSyncStatusLabel("ended")).toBe("Class ended");
  });

  it("maps the relay's terminal and takeover codes", () => {
    expect(toUserFacingError(new Error("ROOM_REVOKED: This classroom has ended.")).code).toBe("ROOM_REVOKED");
    const replaced = toUserFacingError(new Error("WRITER_REPLACED: This board was opened in another tab."));
    expect(replaced.code).toBe("WRITER_REPLACED");
    expect(replaced.message).toMatch(/another tab/i);
  });
});
