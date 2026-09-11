import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

import { boardSyncStatusLabel, extractErrorCode, toUserFacingError } from "@/lib/user-facing-errors";

/**
 * What a production Convex deployment actually delivers.
 *
 * Anything that is not a ConvexError arrives with its message replaced by the
 * literal "Server Error" — the prose is stripped server-side. These cases are
 * the regression guard for that, because a dev deployment passes the message
 * through and hides the whole problem.
 */
describe("production Convex error delivery", () => {
  it("maps a ConvexError by code when the message carries no code text", () => {
    const error = new ConvexError({ code: "SESSION_ENDED", message: "This class has ended." });
    expect(toUserFacingError(error).code).toBe("SESSION_ENDED");
    expect(toUserFacingError(error).message).toMatch(/ended/i);
  });

  it("extracts the code from data, not from the message string", () => {
    // A payload whose message text deliberately contains no code token.
    const error = { data: { code: "INVALID_JOIN_CODE", message: "nope" } };
    expect(extractErrorCode(error)).toBe("INVALID_JOIN_CODE");
    expect(toUserFacingError(error).code).toBe("INVALID_JOIN_CODE");
    expect(toUserFacingError(error).recovery).toBeTruthy();
  });

  it("keeps an unrecognised code usable instead of falling back to generic copy", () => {
    const error = new ConvexError({ code: "QUESTION_CLOSED", message: "That question has closed." });
    const facing = toUserFacingError(error, "Generic.");
    expect(facing.code).toBe("QUESTION_CLOSED");
    expect(facing.message).toBe("That question has closed.");
  });

  it("still falls back when a plain Error had its message stripped", () => {
    expect(toUserFacingError(new Error("Server Error"), "Try again.").message).toBe("Try again.");
  });
});

describe("toUserFacingError", () => {
  it("maps join and session lifecycle codes", () => {
    expect(toUserFacingError(new Error("INVALID_JOIN_CODE: bad")).code).toBe("INVALID_JOIN_CODE");
    expect(toUserFacingError(new Error("SESSION_ENDED: done")).message).toMatch(/ended/i);
    expect(toUserFacingError(new Error("SESSION_NOT_LIVE: wait")).recovery).toBeTruthy();
  });

  it("maps doubt rate limits without exposing stacks", () => {
    const facing = toUserFacingError(new Error("DOUBT_RATE_LIMITED: Please wait before sending another doubt."));
    expect(facing.code).toBe("DOUBT_RATE_LIMITED");
    expect(facing.message).not.toMatch(/Error:|at /);
  });

  it("falls back safely", () => {
    expect(toUserFacingError(new Error("weird"), "Try again.").message).toBe("Try again.");
  });
});

describe("extractErrorCode / boardSyncStatusLabel", () => {
  it("extracts CODE from CODE: detail", () => {
    expect(extractErrorCode(new Error("FORBIDDEN: nope"))).toBe("FORBIDDEN");
  });

  it("labels sync status for UI", () => {
    expect(boardSyncStatusLabel("connected")).toBe("Live");
    expect(boardSyncStatusLabel("connecting")).toBe("Connecting…");
    expect(boardSyncStatusLabel("offline")).toBe("Offline");
  });
});
