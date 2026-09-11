/**
 * One error shape for every client-facing Convex failure.
 *
 * A Convex **production** deployment strips the message off any exception that
 * is not a `ConvexError` — the client receives `Server Error` and nothing else.
 * Development deployments pass the message through, so a codebase that throws
 * plain `Error("CODE: detail")` looks completely correct locally and loses every
 * error code the moment it deploys. `lib/user-facing-errors.ts` maps on those
 * codes, so the whole of `docs/28_ERROR_CODES.md` depends on this file being
 * used instead of `throw new Error`.
 *
 * The payload shape matches what `convex/permissions.ts` already threw, so both
 * halves of the codebase now agree: `{ code, message }`.
 */

import { ConvexError } from "convex/values";

export type SyncVasErrorData = {
  /** Stable machine code from docs/28_ERROR_CODES.md. */
  code: string;
  /** Safe, user-presentable detail. Never include board or doubt text here. */
  message: string;
};

/** Throw a coded, production-visible error. */
export function fail(code: string, message: string): never {
  throw new ConvexError({ code, message } satisfies SyncVasErrorData);
}

/** Reads the `{ code, message }` payload back off an error, if it carries one. */
export function errorData(error: unknown): SyncVasErrorData | null {
  if (!(error instanceof ConvexError)) return null;
  const data = error.data as unknown;
  if (!data || typeof data !== "object") return null;
  const { code, message } = data as Record<string, unknown>;
  return typeof code === "string" && typeof message === "string" ? { code, message } : null;
}

const CODED_MESSAGE = /^([A-Z][A-Z0-9_]+):\s*([\s\S]+)$/;

/**
 * Convert a legacy `"CODE: detail"` plain error into a `ConvexError`.
 *
 * `shared/` stays dependency-free on purpose — the relay type-checks those files
 * and must not pull in Convex — so the shared validators still throw plain
 * errors and are converted here at the Convex boundary.
 */
export function toConvexError(error: unknown): unknown {
  if (error instanceof ConvexError) return error;
  if (!(error instanceof Error)) return error;
  const match = error.message.trim().match(CODED_MESSAGE);
  if (!match) return error;
  return new ConvexError({ code: match[1], message: match[2] } satisfies SyncVasErrorData);
}

/** Run a `shared/` validator and re-throw its coded failure as a `ConvexError`. */
export function rethrowCoded<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    throw toConvexError(error);
  }
}
