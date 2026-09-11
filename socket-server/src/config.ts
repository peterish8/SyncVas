/**
 * Runtime configuration and operational limits for the relay.
 *
 * The relay is the only always-on process in the product, so every knob that
 * protects it from unbounded memory or unbounded work lives here rather than
 * being inlined at a call site. Nothing in this file reads a secret value into
 * a log line.
 */

import { MAX_BOARD_ENVELOPE_BYTES } from "../../shared/protocol/socket.js";
import { BOARD_UPDATE_PER_MINUTE } from "../../shared/constants/limits.js";

/** Minimum length for SOCKET_INTERNAL_SECRET, matched by the Convex + Next minting paths. */
export const MIN_SECRET_LENGTH = 32;

export const LIMITS = {
  /**
   * Socket.IO closes the connection when a frame exceeds this, before any Zod
   * validation runs, so it must stay at or above the protocol's own ceiling.
   */
  maxHttpBufferSize: MAX_BOARD_ENVELOPE_BYTES,

  /**
   * A room with no traffic for this long is evicted from hot state.
   *
   * Sized to outlive a long lesson plus a break, not a working day. The previous
   * six hours meant a teacher who closed the tab held their scene — up to
   * `maxHttpBufferSize`, binary files included — for most of a day, because a
   * closed tab never reaches `revokeRoom`.
   */
  hotRoomIdleMs: 90 * 60 * 1000,

  /**
   * Ceiling on rooms held in hot state, evicted oldest-first.
   *
   * Time-based eviction alone is unbounded in the dimension that matters: nothing
   * limits how many rooms accumulate *within* the idle window. At the protocol
   * ceiling a room costs roughly 2.9 MB (900 KB scene + 2 MB files), so this cap
   * is the difference between a bounded working set and an OOM under abuse.
   */
  maxHotRooms: 200,

  /** How long a revoked sessionId is remembered so late sockets still get ROOM_REVOKED. */
  revokedRoomTtlMs: 60 * 60 * 1000,

  /** How often the eviction sweep runs. */
  sweepIntervalMs: 5 * 60 * 1000,

  /**
   * `board:request-current` makes the server serialize and send the whole scene,
   * so an unthrottled client could amplify one small frame into megabytes.
   */
  requestCurrentPerMinute: 12,

  /**
   * Defence in depth behind the teacher writer lease and the client-side
   * coalescer. Shared with the client so the two cannot drift: when this sat
   * below the client's own flush rate, half a minute of fast handwriting was
   * enough to get the teacher rate-limited.
   */
  boardUpdatePerMinute: BOARD_UPDATE_PER_MINUTE,

  /** Token renewal happens every few minutes; anything near this is a loop. */
  authRefreshPerMinute: 6,

  /**
   * `room:join` re-broadcasts presence to every socket in the room, so one
   * admitted student looping it turns a small frame into an N-socket fan-out.
   * Rejoining is legitimate but rare — it follows a reconnect, not a keystroke.
   */
  roomJoinPerMinute: 30,

  /** 1:1 and cheap, but an unrated event is still an unrated event. */
  foundationPingPerMinute: 120,

  /**
   * Floor on the gap between presence broadcasts for one room. Presence is a
   * participant count; nobody needs it at reconnect-storm frequency.
   */
  presenceMinIntervalMs: 1_000,

  /** Cap on concurrent sockets in one room, so one room cannot exhaust the process. */
  maxSocketsPerRoom: 400,

  /**
   * Tokenless sockets are admitted for health probing and never join a room.
   * They are the one path onto this process that requires no Convex-minted
   * token, so they get a hard global ceiling and a tight per-IP one.
   */
  maxTokenlessSockets: 64,
  maxTokenlessSocketsPerIp: 8,

  /**
   * Cap on concurrent sockets from one address.
   *
   * Deliberately generous: schools NAT an entire site behind a single egress IP,
   * so a tight cap here drops real classrooms rather than attackers. The narrow
   * limit that actually bounds an anonymous attacker is the tokenless pair above
   * — everything counted here already presented a signed room token.
   */
  maxSocketsPerIp: 256,

  /**
   * A socket that never joins a room is holding a file descriptor for nothing.
   * Health probes finish well inside this; a real classroom socket joins during
   * the handshake, before this timer is ever armed.
   */
  unjoinedSocketGraceMs: 30_000,
} as const;

/**
 * Runtime-tunable subset of LIMITS, so a test can exercise a cap with three
 * sockets instead of 256.
 *
 * Widened to `number` deliberately: `LIMITS` is `as const`, so a `Pick` would
 * inherit the literal types and only ever accept the production values back.
 */
export type LimitOverrides = Partial<Record<
  | "maxSocketsPerRoom"
  | "maxTokenlessSockets"
  | "maxTokenlessSocketsPerIp"
  | "maxSocketsPerIp"
  | "unjoinedSocketGraceMs"
  | "presenceMinIntervalMs"
  | "roomJoinPerMinute"
  | "foundationPingPerMinute",
  number
>>;

export type RelayConfig = {
  port: number;
  allowedOrigins: string[];
  secret: string | null;
  isProduction: boolean;
  debugEvents: boolean;
};

export class ConfigError extends Error {}

/**
 * Resolve config from the environment.
 *
 * In production a missing or short secret is fatal: without it `verifyRoomToken`
 * rejects every token, so the service would boot "healthy" and then refuse every
 * classroom. Failing at startup surfaces that as a deploy failure instead.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): RelayConfig {
  const isProduction = env.NODE_ENV === "production";
  const secret = env.SOCKET_INTERNAL_SECRET?.trim() || null;

  if (isProduction && (!secret || secret.length < MIN_SECRET_LENGTH)) {
    throw new ConfigError(
      `SOCKET_INTERNAL_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters in production. ` +
        "Every room token is rejected without it.",
    );
  }

  const port = Number(env.SOCKET_PORT ?? 4001);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new ConfigError(`SOCKET_PORT must be a valid port number, received "${env.SOCKET_PORT}".`);
  }

  const allowedOrigins = (env.ALLOWED_WEB_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (allowedOrigins.length === 0) {
    throw new ConfigError("ALLOWED_WEB_ORIGINS resolved to an empty list; browsers would be blocked by CORS.");
  }
  if (isProduction && allowedOrigins.includes("*")) {
    throw new ConfigError("ALLOWED_WEB_ORIGINS must not be \"*\" in production.");
  }

  // Every piece of relay state is process memory: the teacher writer lease, the
  // hot scene per room, the revocation tombstones, and the per-socket rate
  // counters. Socket.IO needs sticky sessions plus an adapter to span instances
  // (https://socket.io/docs/v4/using-multiple-nodes/) and this relay has neither.
  //
  // At two replicas the failure is silent rather than loud: two teachers each
  // hold the "only" writer lease, students on different instances see different
  // boards, `board:current` returns an empty scene to anyone whose instance
  // never saw an update, and End Class evicts only the instance the revoke
  // request happened to reach. Nothing throws; the classroom just quietly
  // disagrees with itself.
  //
  // So production must acknowledge the constraint explicitly. This is a
  // deployment assertion, not a feature flag — the day it becomes false, this
  // line is what stops the deploy instead of a teacher reporting a lost lesson.
  if (isProduction && env.RELAY_SINGLE_INSTANCE !== "1") {
    throw new ConfigError(
      "RELAY_SINGLE_INSTANCE must be set to \"1\" in production. The relay keeps the writer lease, " +
        "hot board state, and revocation tombstones in process memory, so it is only correct at one " +
        "replica. Set replicas to 1 and this variable to \"1\" to acknowledge, or add a Socket.IO " +
        "adapter plus sticky sessions before scaling out.",
    );
  }

  // The per-address connection cap is only meaningful if the address it counts is
  // the client's. Behind a load balancer every socket presents the balancer's
  // address, so the cap would stop being an abuse control and start being a
  // service-wide ceiling — one full classroom (maxSocketsPerRoom) already exceeds
  // maxSocketsPerIp, so the relay would begin refusing legitimate students at
  // exactly the moment a class filled up. There is no safe default here, only a
  // stated one, so production has to declare its proxy posture.
  if (isProduction && env.RELAY_TRUST_PROXY !== "0" && env.RELAY_TRUST_PROXY !== "1") {
    throw new ConfigError(
      'RELAY_TRUST_PROXY must be set to "1" or "0" in production. Set "1" when the relay sits behind ' +
        'exactly one trusted proxy or load balancer, so the client address is read from the last ' +
        'X-Forwarded-For hop; set "0" only when clients connect to this process directly. Guessing ' +
        "wrong either caps the whole service at one address's budget, or lets a forged header bypass " +
        "the per-address cap entirely.",
    );
  }

  return {
    port,
    allowedOrigins,
    secret,
    isProduction,
    // Per-event logging runs at teacher viewport frame rate; opt in explicitly.
    debugEvents: env.SOCKET_DEBUG_EVENTS === "1",
  };
}
