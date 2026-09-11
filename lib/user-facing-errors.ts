/**
 * Maps stable backend/protocol error codes to user-facing copy.
 * Raw codes must not be the primary UI string (see .planning/PRODUCTION-UX-CONTRACT.md).
 */

export type UserFacingError = {
  code: string | null;
  message: string;
  /** Optional next-step hint shown under the message */
  recovery?: string;
};

const KNOWN: Array<{ match: RegExp; result: UserFacingError }> = [
  {
    match: /INVALID_JOIN_CODE|SESSION_NOT_FOUND/i,
    result: {
      code: "INVALID_JOIN_CODE",
      message: "Check the six-character code and try again.",
      recovery: "Ask your teacher for the current room code or QR.",
    },
  },
  {
    match: /SESSION_ENDED/i,
    result: {
      code: "SESSION_ENDED",
      message: "That class has ended.",
      recovery: "Ask the teacher for a new code when the next class starts.",
    },
  },
  {
    match: /SESSION_NOT_LIVE/i,
    result: {
      code: "SESSION_NOT_LIVE",
      message: "That class is not open yet.",
      recovery: "Wait for the teacher to start the room, then try again.",
    },
  },
  {
    match: /ROOM_REVOKED/i,
    result: {
      code: "ROOM_REVOKED",
      message: "This class has ended.",
      recovery: "Open the class notes, or join another class.",
    },
  },
  {
    match: /WRITER_REPLACED/i,
    result: {
      code: "WRITER_REPLACED",
      message: "This board was opened in another tab.",
      recovery: "Keep teaching in the other tab, or reload this one to move the board back here.",
    },
  },
  {
    match: /WRITER_ALREADY_ACTIVE/i,
    result: {
      code: "WRITER_ALREADY_ACTIVE",
      message: "Another teacher is already editing this room.",
      recovery: "Close the duplicate teacher tab.",
    },
  },
  {
    match: /DOUBT_RATE_LIMITED|RATE_LIMITED/i,
    result: {
      code: "DOUBT_RATE_LIMITED",
      message: "Please wait a moment before sending another doubt.",
    },
  },
  {
    match: /MODERATION_REJECTED/i,
    result: {
      code: "MODERATION_REJECTED",
      message: "That message was filtered. Try a clearer question about the lesson.",
    },
  },
  {
    match: /TOKEN_EXPIRED|UNAUTHORIZED/i,
    result: {
      code: "TOKEN_EXPIRED",
      message: "Your connection expired.",
      recovery: "Reconnect or join the class again.",
    },
  },
  {
    match: /PAYLOAD_TOO_LARGE|SCENE_TOO_LARGE/i,
    result: {
      code: "PAYLOAD_TOO_LARGE",
      message: "That update is too large to send.",
      recovery: "Simplify the board or try again.",
    },
  },
  {
    match: /EXPORT_GENERATION_FAILED/i,
    result: {
      code: "EXPORT_GENERATION_FAILED",
      message: "Export failed. Your board is still saved.",
      recovery: "Retry export from History.",
    },
  },
  {
    match: /FINAL_SNAPSHOT_MISSING|FINAL_BOARD_REQUIRED/i,
    result: {
      code: "FINAL_BOARD_REQUIRED",
      message: "We could not confirm the saved board yet.",
      recovery: "Keep the room open and try ending again.",
    },
  },
  {
    match: /FORBIDDEN|STUDENT_BOARD_EDIT_FORBIDDEN/i,
    result: {
      code: "FORBIDDEN",
      message: "That action is not allowed in this room.",
    },
  },
];

/**
 * Read the `{ code, message }` payload a Convex function threw.
 *
 * This is the only channel that survives a production Convex deployment: any
 * exception that is not a `ConvexError` reaches the browser as the literal
 * string "Server Error", with the real message stripped. Duck-typed rather than
 * `instanceof ConvexError` so it also works across bundle boundaries and on the
 * plain objects the tests construct.
 */
function convexErrorData(error: unknown): { code: string; message: string } | null {
  if (!error || typeof error !== "object" || !("data" in error)) return null;
  const data = (error as { data?: unknown }).data;
  if (!data || typeof data !== "object") return null;
  const { code, message } = data as Record<string, unknown>;
  if (typeof code !== "string") return null;
  return { code, message: typeof message === "string" ? message : "" };
}

/** Extract the stable code from a ConvexError payload or a "CODE: detail" string. */
export function extractErrorCode(error: unknown): string | null {
  const structured = convexErrorData(error);
  if (structured) return structured.code;
  const message = error instanceof Error ? error.message : String(error ?? "");
  const match = message.trim().match(/^([A-Z][A-Z0-9_]+)\s*:/);
  return match?.[1] ?? null;
}

export function toUserFacingError(error: unknown, fallback = "Something went wrong. Try again."): UserFacingError {
  const structured = convexErrorData(error);
  // Match on the code alone when we have one. The relay's `protocol:error`
  // frames and any remaining string-shaped errors still fall through to the
  // message match below, so both transports keep working.
  if (structured) {
    for (const entry of KNOWN) {
      if (entry.match.test(structured.code)) return entry.result;
    }
    if (structured.message) return { code: structured.code, message: structured.message };
    return { code: structured.code, message: fallback };
  }

  const message = error instanceof Error ? error.message : String(error ?? "");
  for (const entry of KNOWN) {
    if (entry.match.test(message)) return entry.result;
  }
  // Prefer the human detail after "CODE: " when present.
  const detail = message.includes(": ") ? message.split(": ").slice(1).join(": ").trim() : "";
  if (detail && detail.length < 160 && !/at\s+\S+|Error:|stack/i.test(detail)) {
    return { code: extractErrorCode(error), message: detail };
  }
  return { code: extractErrorCode(error), message: fallback };
}

/**
 * Accepts `BoardSyncStatus` from components/board/use-board-sync.ts. Spelled out
 * rather than imported so lib/ does not depend on components/; `"ended"` is the
 * terminal state after the room is revoked or the session has ended.
 */
export function boardSyncStatusLabel(status: "idle" | "connecting" | "connected" | "offline" | "ended"): string {
  switch (status) {
    case "ended":
      return "Class ended";
    case "connected":
      return "Live";
    case "connecting":
      return "Connecting…";
    case "offline":
      return "Offline";
    default:
      return "Idle";
  }
}
