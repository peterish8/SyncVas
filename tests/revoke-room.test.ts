/**
 * Socket revocation retry — the path that closes a live classroom.
 *
 * Revocation is the only thing that evicts sockets admitted before End Class.
 * Until it lands, those sockets keep relaying the board on tokens that stay
 * valid for the rest of their TTL, so a relay that is merely restarting during
 * End Class used to mean the class carried on broadcasting after the teacher
 * closed it. Previously the failure was returned and dropped; these cases pin
 * the retry and the recorded outcome instead.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { run } from "@/convex/internal/revokeRoom";
import { recordRevocationOutcome } from "@/convex/sessions";
import { createFakeConvex, handlerOf } from "./helpers/fake-convex";

const SESSION = "sessions:live";
const SECRET = "s".repeat(32);

const invoke = handlerOf<{ sessionId: string; attempt?: number }, {
  ok: boolean;
  reason?: string;
  attempt?: number;
  retrying?: boolean;
}>(run);

function world() {
  return createFakeConvex({
    seed: {
      sessions: [{ _id: SESSION, status: "ending", teacherId: "users:owner", joinCode: "ABC123", latestBoardVersion: 1, title: "Class" }],
    },
  });
}

beforeEach(() => {
  process.env.SOCKET_SERVICE_INTERNAL_URL = "https://relay.test";
  process.env.SOCKET_INTERNAL_SECRET = SECRET;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SOCKET_SERVICE_INTERNAL_URL;
  delete process.env.SOCKET_INTERNAL_SECRET;
});

describe("revokeRoom retry", () => {
  it("retries a transient relay outage instead of dropping the revocation", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    const fake = world();

    const result = await invoke(fake.ctx, { sessionId: SESSION });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("SOCKET_REVOCATION_UNAVAILABLE");
    expect(result.retrying).toBe(true);
    // A retry is queued with the attempt counter advanced...
    expect(fake.scheduled).toHaveLength(1);
    expect(fake.scheduled[0].args).toMatchObject({ sessionId: SESSION, attempt: 1 });
    // ...and nothing is recorded yet, because the outage may still resolve.
    expect(fake.mutations).toHaveLength(0);
  });

  it("retries a non-2xx rejection too, since a restarting relay answers 503", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    const fake = world();

    const result = await invoke(fake.ctx, { sessionId: SESSION });

    expect(result.reason).toBe("SOCKET_REVOCATION_REJECTED");
    expect(fake.scheduled).toHaveLength(1);
  });

  it("records a warning once the attempts are exhausted", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    const fake = world();

    // Attempt 5 is the last of six; there must be no seventh.
    const result = await invoke(fake.ctx, { sessionId: SESSION, attempt: 5 });

    expect(result.retrying).toBe(false);
    expect(fake.scheduled).toHaveLength(0);
    expect(fake.mutations).toHaveLength(1);
    expect(fake.mutations[0].args).toMatchObject({
      sessionId: SESSION,
      warning: "SOCKET_REVOCATION_UNAVAILABLE",
    });
  });

  it("clears an earlier warning when a retry finally succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 200 })));
    const fake = world();

    const result = await invoke(fake.ctx, { sessionId: SESSION, attempt: 3 });

    expect(result.ok).toBe(true);
    expect(fake.scheduled).toHaveLength(0);
    // A room that eventually revoked must not keep advertising a stale failure.
    expect(fake.mutations[0].args).toMatchObject({ sessionId: SESSION, warning: null });
  });

  it("does not retry a misconfiguration, which no amount of waiting fixes", async () => {
    delete process.env.SOCKET_SERVICE_INTERNAL_URL;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const fake = world();

    const result = await invoke(fake.ctx, { sessionId: SESSION });

    expect(result.reason).toBe("SOCKET_REVOCATION_NOT_CONFIGURED");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fake.scheduled).toHaveLength(0);
    expect(fake.mutations[0].args).toMatchObject({ warning: "SOCKET_REVOCATION_NOT_CONFIGURED" });
  });
});

describe("recordRevocationOutcome", () => {
  const applyOutcome = handlerOf<{ sessionId: string; warning: string | null }, unknown>(recordRevocationOutcome);

  it("stores the warning on the session so the failure is visible", async () => {
    const fake = world();
    await applyOutcome(fake.ctx, { sessionId: SESSION, warning: "SOCKET_REVOCATION_UNAVAILABLE" });
    expect(fake.rows("sessions")[0]).toMatchObject({ revocationWarning: "SOCKET_REVOCATION_UNAVAILABLE" });
  });

  it("clears the warning when revocation later succeeds", async () => {
    const fake = world();
    await applyOutcome(fake.ctx, { sessionId: SESSION, warning: "SOCKET_REVOCATION_UNAVAILABLE" });
    await applyOutcome(fake.ctx, { sessionId: SESSION, warning: null });
    expect(fake.rows("sessions")[0].revocationWarning).toBeUndefined();
  });
});
