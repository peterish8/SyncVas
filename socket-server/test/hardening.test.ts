import { createServer } from "node:http";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MAX_BOARD_ENVELOPE_BYTES, MAX_BOARD_FILES_BYTES, MAX_BOARD_SCENE_BYTES } from "../../shared/protocol/socket.js";
import {
  getHotScene,
  hotStateStats,
  isRoomRevoked,
  markRoomRevoked,
  resetHotState,
  setHotScene,
  setHotViewport,
  sweepHotState,
} from "../src/board-hot-state.js";
import { ConfigError, LIMITS, loadConfig } from "../src/config.js";
import { allowAction, createRateLimitState } from "../src/rate-limit.js";
import { createSocketServer } from "../src/server.js";

describe("transport limits", () => {
  it("sizes the socket buffer above the protocol's own payload ceiling", async () => {
    // Socket.IO drops oversized frames and closes the connection before Zod runs,
    // so a buffer smaller than the schema ceiling makes large boards fail as a
    // disconnect instead of a clean validation error.
    const httpServer = createServer();
    const io = createSocketServer(httpServer, ["http://localhost:3000"]);
    const engineOpts = (io as unknown as { engine?: { opts?: Record<string, unknown> } }).engine?.opts;

    expect(engineOpts?.maxHttpBufferSize).toBe(MAX_BOARD_ENVELOPE_BYTES);
    expect(MAX_BOARD_ENVELOPE_BYTES).toBeGreaterThanOrEqual(MAX_BOARD_SCENE_BYTES + MAX_BOARD_FILES_BYTES);

    await new Promise<void>((resolve) => io.close(() => httpServer.close(() => resolve())));
  });
});

describe("hot state eviction", () => {
  beforeEach(() => resetHotState());
  afterEach(() => resetHotState());

  it("evicts a room that went idle without ever being ended", () => {
    // A teacher who closes the tab never triggers revokeRoom, so without this
    // sweep the scene and its binary files stay resident for the process's life.
    const now = Date.now();
    setHotScene("idle", { version: 1, scene: {}, updatedAt: now - LIMITS.hotRoomIdleMs - 1 });
    setHotScene("active", { version: 1, scene: {}, updatedAt: now });

    expect(sweepHotState(now).rooms).toBe(1);
    expect(hotStateStats().rooms).toBe(1);
  });

  it("keeps a room alive while only its viewport is moving", () => {
    const now = Date.now();
    setHotScene("lecturing", { version: 1, scene: {}, updatedAt: now - LIMITS.hotRoomIdleMs - 1 });
    setHotViewport("lecturing", { x: 1, y: 2, zoom: 1, ts: now });

    expect(sweepHotState(now).rooms).toBe(0);
    expect(hotStateStats().rooms).toBe(1);
  });

  it("expires revocation tombstones instead of remembering every ended class forever", () => {
    markRoomRevoked("ended");
    expect(isRoomRevoked("ended")).toBe(true);

    const later = Date.now() + LIMITS.revokedRoomTtlMs + 1;
    expect(sweepHotState(later).revoked).toBe(1);
    expect(hotStateStats().revoked).toBe(0);
  });

  it("still reports a freshly revoked room as revoked", () => {
    markRoomRevoked("just-ended");
    expect(isRoomRevoked("just-ended")).toBe(true);
    expect(hotStateStats().rooms).toBe(0);
  });
});

describe("rate limiting", () => {
  it("allows a burst up to the limit and then refuses within the same minute", () => {
    const state = createRateLimitState();
    const now = Date.now();
    for (let i = 0; i < LIMITS.requestCurrentPerMinute; i += 1) {
      expect(allowAction(state, "board:request-current", LIMITS.requestCurrentPerMinute, now)).toBe(true);
    }
    expect(allowAction(state, "board:request-current", LIMITS.requestCurrentPerMinute, now)).toBe(false);
  });

  it("recovers once the window slides past the earlier hits", () => {
    const state = createRateLimitState();
    const now = Date.now();
    for (let i = 0; i < LIMITS.requestCurrentPerMinute; i += 1) {
      allowAction(state, "board:request-current", LIMITS.requestCurrentPerMinute, now);
    }
    expect(allowAction(state, "board:request-current", LIMITS.requestCurrentPerMinute, now + 60_001)).toBe(true);
  });

  it("counts each action independently", () => {
    const state = createRateLimitState();
    const now = Date.now();
    expect(allowAction(state, "a", 1, now)).toBe(true);
    expect(allowAction(state, "a", 1, now)).toBe(false);
    expect(allowAction(state, "b", 1, now)).toBe(true);
  });
});

describe("config validation", () => {
  const base = {
    NODE_ENV: "production",
    SOCKET_INTERNAL_SECRET: "y".repeat(32),
    ALLOWED_WEB_ORIGINS: "https://syncvas.app",
    RELAY_SINGLE_INSTANCE: "1",
    RELAY_TRUST_PROXY: "0",
  };

  it("refuses to start in production without a usable secret", () => {
    // Without the secret every room token fails verification, so the service
    // would pass health checks while refusing every classroom.
    expect(() => loadConfig({ ...base, SOCKET_INTERNAL_SECRET: "" } as NodeJS.ProcessEnv)).toThrow(ConfigError);
    expect(() => loadConfig({ ...base, SOCKET_INTERNAL_SECRET: "short" } as NodeJS.ProcessEnv)).toThrow(ConfigError);
  });

  it("refuses a wildcard origin in production", () => {
    expect(() => loadConfig({ ...base, ALLOWED_WEB_ORIGINS: "*" } as NodeJS.ProcessEnv)).toThrow(ConfigError);
  });

  it("refuses an unusable port", () => {
    expect(() => loadConfig({ ...base, SOCKET_PORT: "not-a-port" } as NodeJS.ProcessEnv)).toThrow(ConfigError);
  });

  it("accepts a valid production environment and keeps per-event logging off by default", () => {
    const config = loadConfig(base as NodeJS.ProcessEnv);
    expect(config.allowedOrigins).toEqual(["https://syncvas.app"]);
    expect(config.isProduction).toBe(true);
    expect(config.debugEvents).toBe(false);
  });

  it("allows development to run without a secret so local work is not blocked", () => {
    expect(() => loadConfig({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).not.toThrow();
  });

  it("refuses to start in production without acknowledging single-instance operation", () => {
    // Every piece of relay state is process memory. At two replicas nothing
    // throws — the writer lease, hot board, and revocation just quietly stop
    // agreeing across instances — so the deploy is the only place to catch it.
    const withoutAck: Record<string, string> = { ...base };
    delete withoutAck.RELAY_SINGLE_INSTANCE;
    expect(() => loadConfig(withoutAck as NodeJS.ProcessEnv)).toThrow(ConfigError);
    expect(() => loadConfig({ ...base, RELAY_SINGLE_INSTANCE: "0" } as NodeJS.ProcessEnv)).toThrow(ConfigError);
  });

  it("refuses to start in production without a declared proxy posture", () => {
    // Unstated, the per-address cap either throttles the whole service (behind a
    // balancer, every socket shares one address) or is bypassable by a forged
    // header. Both are silent, so neither may be the default.
    const withoutPosture: Record<string, string> = { ...base };
    delete withoutPosture.RELAY_TRUST_PROXY;
    expect(() => loadConfig(withoutPosture as NodeJS.ProcessEnv)).toThrow(ConfigError);
    expect(() => loadConfig({ ...base, RELAY_TRUST_PROXY: "yes" } as NodeJS.ProcessEnv)).toThrow(ConfigError);
    expect(() => loadConfig({ ...base, RELAY_TRUST_PROXY: "1" } as NodeJS.ProcessEnv)).not.toThrow();
  });

  it("keeps development free of both production-only acknowledgements", () => {
    expect(() =>
      loadConfig({ NODE_ENV: "development", ALLOWED_WEB_ORIGINS: "http://localhost:3000" } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });
});

describe("http surface", () => {
  it("answers health checks and 404s unknown paths instead of hanging", async () => {
    // An unmatched request with no response written hangs until the client gives
    // up, which is indistinguishable from a dead service to a platform probe.
    const httpServer = createServer();
    const io = createSocketServer(httpServer, ["http://localhost:3000"]);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP address.");

    try {
      const health = await fetch(`http://127.0.0.1:${address.port}/healthz`, { signal: AbortSignal.timeout(3000) });
      expect(health.status).toBe(200);
      expect(await health.json()).toMatchObject({ ok: true, service: "syncvas-socket" });

      const missing = await fetch(`http://127.0.0.1:${address.port}/nope`, { signal: AbortSignal.timeout(3000) });
      expect(missing.status).toBe(404);
    } finally {
      await new Promise<void>((resolve) => io.close(() => httpServer.close(() => resolve())));
    }
  });
});

describe("hot state room ceiling", () => {
  beforeEach(() => resetHotState());
  afterEach(() => resetHotState());

  it("evicts the least recently updated rooms once the cap is exceeded", () => {
    // The idle sweep bounds how long a room is held, not how many are held at
    // once. Without a ceiling, enough concurrent rooms inside the idle window
    // exhaust the process — each one costs up to the protocol payload ceiling.
    const overflow = 5;
    for (let index = 0; index < LIMITS.maxHotRooms + overflow; index += 1) {
      setHotScene(`session-${index}`, {
        version: 1,
        scene: { elements: [] },
        // Ascending timestamps make room-0 the oldest and therefore first out.
        updatedAt: 1_000 + index,
      });
    }

    expect(hotStateStats().rooms).toBe(LIMITS.maxHotRooms);
    // The oldest `overflow` rooms are gone; the newest survive.
    expect(getHotScene("session-0")).toBeUndefined();
    expect(getHotScene(`session-${overflow - 1}`)).toBeUndefined();
    expect(getHotScene(`session-${overflow}`)).toBeDefined();
    expect(getHotScene(`session-${LIMITS.maxHotRooms + overflow - 1}`)).toBeDefined();
  });

  it("keeps an evicted room recoverable: the next update simply repopulates it", () => {
    // Hot state is a cache in front of the Convex snapshot, so eviction must be
    // survivable rather than destructive.
    for (let index = 0; index < LIMITS.maxHotRooms + 1; index += 1) {
      setHotScene(`room-${index}`, { version: 1, scene: {}, updatedAt: 1_000 + index });
    }
    expect(getHotScene("room-0")).toBeUndefined();

    setHotScene("room-0", { version: 2, scene: { elements: ["redrawn"] }, updatedAt: Date.now() });
    expect(getHotScene("room-0")?.version).toBe(2);
  });
});
