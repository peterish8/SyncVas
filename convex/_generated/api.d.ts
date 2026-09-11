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
import type * as boardAssets from "../boardAssets.js";
import type * as boardAuthoring from "../boardAuthoring.js";
import type * as boardSnapshots from "../boardSnapshots.js";
import type * as boardTemplates from "../boardTemplates.js";
import type * as doubts from "../doubts.js";
import type * as errors from "../errors.js";
import type * as exports from "../exports.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as internal_backfillCounts from "../internal/backfillCounts.js";
import type * as internal_exportJobs from "../internal/exportJobs.js";
import type * as internal_moderation from "../internal/moderation.js";
import type * as internal_revokeRoom from "../internal/revokeRoom.js";
import type * as internal_summarize from "../internal/summarize.js";
import type * as moderation from "../moderation.js";
import type * as participants from "../participants.js";
import type * as permissions from "../permissions.js";
import type * as quiz from "../quiz.js";
import type * as sessions from "../sessions.js";
import type * as summaries from "../summaries.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authBootstrap: typeof authBootstrap;
  board: typeof board;
  boardAssets: typeof boardAssets;
  boardAuthoring: typeof boardAuthoring;
  boardSnapshots: typeof boardSnapshots;
  boardTemplates: typeof boardTemplates;
  doubts: typeof doubts;
  errors: typeof errors;
  exports: typeof exports;
  health: typeof health;
  http: typeof http;
  "internal/backfillCounts": typeof internal_backfillCounts;
  "internal/exportJobs": typeof internal_exportJobs;
  "internal/moderation": typeof internal_moderation;
  "internal/revokeRoom": typeof internal_revokeRoom;
  "internal/summarize": typeof internal_summarize;
  moderation: typeof moderation;
  participants: typeof participants;
  permissions: typeof permissions;
  quiz: typeof quiz;
  sessions: typeof sessions;
  summaries: typeof summaries;
  users: typeof users;
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
