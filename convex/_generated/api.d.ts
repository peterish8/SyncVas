/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as authBootstrap from "../authBootstrap.js";
import type * as board from "../board.js";
import type * as boardSnapshots from "../boardSnapshots.js";
import type * as doubts from "../doubts.js";
import type * as exports from "../exports.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as internal_exportJobs from "../internal/exportJobs.js";
import type * as internal_finalizeBoard from "../internal/finalizeBoard.js";
import type * as internal_moderation from "../internal/moderation.js";
import type * as internal_revokeRoom from "../internal/revokeRoom.js";
import type * as moderation from "../moderation.js";
import type * as participants from "../participants.js";
import type * as sessions from "../sessions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authBootstrap: typeof authBootstrap;
  board: typeof board;
  boardSnapshots: typeof boardSnapshots;
  doubts: typeof doubts;
  exports: typeof exports;
  health: typeof health;
  http: typeof http;
  "internal/exportJobs": typeof internal_exportJobs;
  "internal/finalizeBoard": typeof internal_finalizeBoard;
  "internal/moderation": typeof internal_moderation;
  "internal/revokeRoom": typeof internal_revokeRoom;
  moderation: typeof moderation;
  participants: typeof participants;
  sessions: typeof sessions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
