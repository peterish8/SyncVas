/**
 * Part 2: convex / socket-server / shared / lib / tests / ci stubs
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const force = process.env.FORCE === "1";

function write(rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (!force && fs.existsSync(abs)) {
    const existing = fs.readFileSync(abs, "utf8");
    if (existing.trim().length > 0 && !existing.includes("@scaffold")) {
      console.log("skip (exists):", rel);
      return;
    }
  }
  fs.writeFileSync(abs, content, "utf8");
  console.log("write:", rel);
}

const banner = (phase, title, lines) =>
  [
    `/**`,
    ` * @scaffold true`,
    ` * @phase ${phase}`,
    ` * ${title}`,
    ` *`,
    ...lines.map((l) => ` * ${l}`),
    ` *`,
    ` * Non-negotiables: validate public args; ownership checks; indexed queries;`,
    ` * internal work via internal functions; never log raw doubt text/secrets.`,
    ` */`,
    ``,
  ].join("\n");

// ─── convex ─────────────────────────────────────────────────────────────────

write(
  "convex/auth.ts",
  `${banner("3", "Auth helpers (Convex Auth abstraction)", [
    "Implement requireAuthSubject, requireTeacher, requireSessionOwner.",
    "Resolve identity from ctx.auth — NEVER trust client-provided teacherId/role.",
    "Used by sessions/participants/doubts/exports public mutations.",
  ])}
import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

type AuthCtx = QueryCtx | MutationCtx;

export async function requireAuthSubject(ctx: AuthCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  const subject = identity?.subject;
  if (!subject) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Sign in to manage a classroom.",
    });
  }
  return subject;
}

export async function requireTeacher(ctx: AuthCtx): Promise<Doc<"users">> {
  const subject = await requireAuthSubject(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_subject", (q) => q.eq("authSubject", subject))
    .unique();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "A teacher account is required.",
    });
  }
  return user;
}

export async function requireSessionOwner(ctx: AuthCtx, sessionId: Id<"sessions">) {
  const teacher = await requireTeacher(ctx);
  const session = await ctx.db.get(sessionId);
  if (!session || session.teacherId !== teacher._id) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Classroom not found." });
  }
  return { teacher, session };
}
`,
);

write(
  "convex/sessions.ts",
  `${banner("3+6+8", "Session lifecycle", [
    "Phase 3: create (server joinCode), getByJoinCode, end (reject joins), list for teacher.",
    "Phase 6: live→ending→ended finalization trigger; latestBoardVersion / latestSnapshotId.",
    "Phase 8: history listing for ended sessions.",
    "Use indexes by_join_code, by_teacher_status, by_teacher_started.",
    "Public end schedules internal finalize — do not call public from scheduler.",
  ])}
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// PHASE 3: export create, end, getByJoinCode, get, listMine
// PHASE 6: export requestFinalize (public) → internal finalizeBoard
// Stubs below keep the module valid without registering incomplete API surface yet.

export const _scaffoldPing = query({
  args: {},
  handler: async () => ({ phase: 3, module: "sessions", ready: false }),
});

void mutation;
void v;
`,
);

write(
  "convex/participants.ts",
  `${banner("3+5", "Pseudonymous participants", [
    "Upsert by_session_anonymous; store anonymousIdHash only — no real names.",
    "join live sessions only; bump lastSeenAt; doubtCount for rate limits.",
    "Abuse controls use participant id, not PII.",
  ])}
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const _scaffoldPing = query({
  args: {},
  handler: async () => ({ phase: 3, module: "participants", ready: false }),
});

void mutation;
void v;
`,
);

write(
  "convex/doubts.ts",
  `${banner("5+7", "Anonymous doubts + votes", [
    "Phase 5: submit (220 chars), rate-limit per participant WITHOUT AI,",
    "  teacher queue by_session_status_created, answer/dismiss, vote once.",
    "Phase 7: deterministic screening first; adapter triage; uncertain fallback;",
    "  duplicate suggestions via normalizedText (no embeddings).",
    "Never put raw doubt text in logs/telemetry.",
  ])}
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const _scaffoldPing = query({
  args: {},
  handler: async () => ({ phase: 5, module: "doubts", ready: false }),
});

void mutation;
void v;
`,
);

write(
  "convex/board.ts",
  `${banner("6", "Final board persistence API", [
    "Public: teacher requests finalize; students never call.",
    "Store large scenes in _storage; boardSnapshots hold metadata + storageId.",
    "Idempotent finalize; no HF pen pointer documents.",
  ])}
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const _scaffoldPing = query({
  args: {},
  handler: async () => ({ phase: 6, module: "board", ready: false }),
});

void mutation;
void v;
`,
);

write(
  "convex/boardSnapshots.ts",
  `${banner("6", "Snapshot metadata helpers", [
    "Indexed lookups for latest/final snapshots; prefer storage IDs over inline JSON blobs.",
  ])}
import { query } from "./_generated/server";

export const _scaffoldPing = query({
  args: {},
  handler: async () => ({ phase: 6, module: "boardSnapshots", ready: false }),
});
`,
);

write(
  "convex/exports.ts",
  `${banner("8", "Export jobs", [
    "Owner-checked create job; status queued→processing→ready|failed.",
    "Input = durable final scene; optional AI summary failure must not wipe scene.",
  ])}
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const _scaffoldPing = query({
  args: {},
  handler: async () => ({ phase: 8, module: "exports", ready: false }),
});

void mutation;
void v;
`,
);

write(
  "convex/moderation.ts",
  `${banner("7", "Deterministic moderation + adapter boundary", [
    "Profanity/noise/length/repeat before any AI.",
    "Call lib/ai moderation adapter only after cheap filters.",
    "Disabled/uncertain/failed → keep plausible doubts visible (no silent drop).",
  ])}
import { query } from "./_generated/server";

export const _scaffoldPing = query({
  args: {},
  handler: async () => ({ phase: 7, module: "moderation", ready: false }),
});
`,
);

write(
  "convex/http.ts",
  `${banner("10", "Optional HTTP actions for provider webhooks (if needed)", [
    "Prefer adapter invoked from internal actions over public HTTP.",
    "If HTTP is required: auth webhooks, never expose secrets, never echo doubt text.",
  ])}
import { httpRouter } from "convex/server";

const http = httpRouter();
// PHASE 10: register routes only if provider requires them.

export default http;
`,
);

write(
  "convex/internal/finalizeBoard.ts",
  `${banner("6", "Internal finalization", [
    "Called only from internal/scheduled paths after public end.",
    "Capture scene once; write storage + boardSnapshots; set session.ended.",
    "Idempotent; resume interrupted finalization without duplicate finals.",
  ])}
import { internalMutation } from "../_generated/server";

export const run = internalMutation({
  args: {},
  handler: async () => {
    // PHASE 6: real args + logic
    return { ok: false, reason: "scaffold" };
  },
});
`,
);

write(
  "convex/internal/exportJobs.ts",
  `${banner("8", "Internal export generation", [
    "Generate image/PDF from final scene in-process when feasible.",
    "Update exports.status; isolate summary failures.",
  ])}
import { internalMutation } from "../_generated/server";

export const processNext = internalMutation({
  args: {},
  handler: async () => ({ ok: false, reason: "scaffold" }),
});
`,
);

write(
  "convex/internal/moderation.ts",
  `${banner("7+10", "Internal AI triage action", [
    "Phase 7: call disabled adapter → uncertain.",
    "Phase 10: wire live provider via lib/ai only; timeout/abort; redact logs.",
  ])}
import { internalAction } from "../_generated/server";

export const triageDoubt = internalAction({
  args: {},
  handler: async () => ({ outcome: "uncertain" as const, reason: "scaffold" }),
});
`,
);

// ─── lib/ai ─────────────────────────────────────────────────────────────────

write(
  "lib/ai/moderation-adapter.ts",
  `${banner("7+10", "Provider-agnostic moderation adapter", [
    "Phase 7: define ModerationRequest/Result Zod schemas; DisabledModerationAdapter → uncertain.",
    "Phase 10: one provider impl under lib/ai/providers; NEVER import SDK in feature/UI code.",
    "Credentials server-only. No student identity. No board dump. No doubt text in logs.",
  ])}
import { z } from "zod";

export const moderationRequestSchema = z
  .object({
    // PHASE 7: minimal fields — normalized text hash or bounded text, session scope
    text: z.string().max(220),
    sessionId: z.string().min(1),
  })
  .strict();

export const moderationResultSchema = z
  .object({
    outcome: z.enum(["accept", "reject", "uncertain"]),
    reasonCode: z.string().optional(),
    relevanceScore: z.number().min(0).max(1).optional(),
  })
  .strict();

export type ModerationRequest = z.infer<typeof moderationRequestSchema>;
export type ModerationResult = z.infer<typeof moderationResultSchema>;

export interface ModerationAdapter {
  moderate(req: ModerationRequest): Promise<ModerationResult>;
}

/** Default until Phase 10 configures a provider. */
export class DisabledModerationAdapter implements ModerationAdapter {
  async moderate(_req: ModerationRequest): Promise<ModerationResult> {
    return { outcome: "uncertain", reasonCode: "provider_disabled" };
  }
}

export function getModerationAdapter(): ModerationAdapter {
  // PHASE 10: if env configured → provider adapter; else disabled
  return new DisabledModerationAdapter();
}
`,
);

write(
  "lib/ai/providers/index.ts",
  `${banner("10", "Live provider wiring", [
    "Select ONE approved provider at execution time; document ADR.",
    "Export factory createLiveModerationAdapter() reading server env only.",
  ])}
import type { ModerationAdapter } from "../moderation-adapter";
import { DisabledModerationAdapter } from "../moderation-adapter";

export function createLiveModerationAdapter(): ModerationAdapter {
  // PHASE 10: construct provider client from process.env.* (server-only)
  return new DisabledModerationAdapter();
}
`,
);

write(
  "shared/constants/limits.ts",
  `${banner("5+7", "Product limits", [
    "Doubt max length 220; rate limits per participant; viewport Hz; board throttle.",
  ])}
export const DOUBT_MAX_CHARS = 220;
export const DOUBT_RATE_LIMIT_WINDOW_MS = 60_000;
export const DOUBT_RATE_LIMIT_MAX = 5;
export const TEACHER_VIEWPORT_MAX_HZ = 15;
export const BOARD_UPDATE_MIN_MS = 50;
`,
);

write(
  "shared/types/session.ts",
  `${banner("3", "Shared session status types", [
    "Mirror Convex session status union for UI without importing generated types into socket-server.",
  ])}
export type SessionStatus = "draft" | "live" | "ending" | "ended";
export type ClassroomRole = "teacher" | "student";
`,
);

// ─── socket-server modules ──────────────────────────────────────────────────

write(
  "socket-server/src/auth.ts",
  `${banner("3", "Signed room admission tokens", [
    "Verify short-lived token from Convex; derive sessionId+role server-side.",
    "Reject forged role fields from the browser. Room join = session:{sessionId} only.",
  ])}
export type RoomClaims = {
  sessionId: string;
  role: "teacher" | "student";
  subjectId?: string;
  exp: number;
};

export function verifyRoomToken(_token: string): RoomClaims | null {
  // PHASE 3: HMAC/JWT verify with server secret
  return null;
}
`,
);

write(
  "socket-server/src/validators.ts",
  `${banner("2", "Re-export / wrap shared Zod validators", [
    "All inbound events: safeParse shared schemas; emit protocol:error on failure.",
  ])}
export {
  SOCKET_EVENTS,
  SOCKET_PROTOCOL_VERSION,
  boardUpdateSchema,
  boardCurrentSchema,
  teacherViewportSchema,
  foundationPingSchema,
  foundationPongSchema,
  protocolErrorSchema,
} from "../../shared/protocol/socket.js";
`,
);

write(
  "socket-server/src/board-hot-state.ts",
  `${banner("2+6", "In-memory latest scene per room", [
    "Keep only latest {version, scene} per sessionId while sockets connected.",
    "Late join → board:current. Reconstructible from Convex snapshot after end.",
    "Never write pointer streams to disk/DB from here.",
  ])}
export type HotScene = { version: number; scene: unknown; updatedAt: number };

const rooms = new Map<string, HotScene>();

export function getHotScene(sessionId: string): HotScene | undefined {
  return rooms.get(sessionId);
}

export function setHotScene(sessionId: string, next: HotScene): void {
  const prev = rooms.get(sessionId);
  if (prev && next.version <= prev.version) return;
  rooms.set(sessionId, next);
}

export function clearHotScene(sessionId: string): void {
  rooms.delete(sessionId);
}
`,
);

write(
  "socket-server/src/rooms.ts",
  `${banner("3", "Room join + coarse presence", [
    "After token verify, socket.join(session:{id}); track coarse counts.",
    "Publish room:presence; disconnect cleanup. Cross-room isolation tests in Phase 9.",
  ])}
import type { Server, Socket } from "socket.io";

export function roomName(sessionId: string): string {
  return \`session:\${sessionId}\`;
}

export function attachRoomHandlers(_io: Server, _socket: Socket): void {
  // PHASE 3: room:join with token; presence; leave on disconnect
}
`,
);

write(
  "socket-server/src/protocol.ts",
  `${banner("2+4", "Classroom event handlers", [
    "Phase 2: board:update (teacher only), board:request-current → board:current.",
    "Phase 4: teacher:viewport forward latest only; lossy OK.",
    "Reject student board:update; validate envelopes; protocol:error codes from docs/28.",
  ])}
import type { Server, Socket } from "socket.io";

export function attachClassroomHandlers(_io: Server, _socket: Socket): void {
  // PHASE 2/4: wire SOCKET_EVENTS board_* and teacherViewport
}
`,
);

// Annotate existing server.ts by writing a companion note file if we shouldn't overwrite —
// We'll patch server.ts carefully with comments via a scaffold header prepend only if still milestone-0 sized.

write(
  "socket-server/src/SERVER_IMPLEMENTATION.md",
  `# socket-server/src/server.ts — implementation map

Phase 1 (done): foundation ping/pong only.

Phase 2: call \`attachClassroomHandlers\` for board:update / request-current; use \`board-hot-state\`.

Phase 3: handshake auth via \`verifyRoomToken\`; \`attachRoomHandlers\`; no spoofable role.

Phase 4: viewport forward in protocol handlers.

Phase 6: on end, allow one snapshot pull for finalization; clear hot state when appropriate.

Phase 8: reconnect clients re-auth + request current.

Phase 9: permission/cross-room adversarial coverage against this server.
`,
);

// ─── tests (skipped until phase execution) ──────────────────────────────────

const skipTest = (file, phase, title, bullets) => {
  write(
    file,
    `${banner(phase, title, bullets)}
import { describe, it, expect } from "vitest";

describe.skip("${title} (enable in Phase ${phase})", () => {
  it("scaffold placeholder", () => {
    expect(true).toBe(true);
  });
});
`,
  );
};

skipTest("tests/board-sync.test.ts", "2", "Board sync proof", [
  "Teacher update accepted; student update rejected; late join current; version gap resync;",
  "student pan does not mutate others or teacher camera.",
]);
skipTest("tests/room-lifecycle.test.ts", "3", "Room lifecycle", [
  "create/end ownership; join code=QR equivalence; ended rejects join; forged role fails.",
]);
skipTest("tests/follow-mode.test.ts", "4", "Follow mode", [
  "follow mirrors viewport; pan exits locally; return works; packets don't corrupt board.",
]);
skipTest("tests/doubts-permissions.test.ts", "5", "Doubts permissions", [
  "anonymous queue; rate limit without AI; one vote; teacher-only resolve.",
]);
skipTest("tests/final-board.test.ts", "6", "Final board persistence", [
  "finalize ownership; no pen streams; restore after refresh; idempotent finalize.",
]);
skipTest("tests/moderation.test.ts", "7", "Moderation", [
  "deterministic block; disabled adapter uncertain; no silent drop; duplicates advisory.",
]);
skipTest("tests/export-history-reconnect.test.ts", "8", "Export/history/reconnect", [
  "export authz/status; empty history; reconnect resync; summary failure isolation.",
]);
skipTest("tests/ai-adapter.test.ts", "10", "AI adapter contract", [
  "success/disabled/timeout/bad response/rate limit → uncertain; no secrets in logs.",
]);

write(
  "tests/security/permissions.test.ts",
  `${banner("9", "Adversarial permission suite", [
    "Forged roles, token mismatch, cross-room, student board mutate, Convex ownership,",
    "exports/history access, no secrets in browser bundle.",
  ])}
import { describe, it, expect } from "vitest";

describe.skip("SEC permission boundaries (Phase 9)", () => {
  it("scaffold", () => {
    expect(true).toBe(true);
  });
});
`,
);

write(
  "tests/load/viewers-100.smoke.ts",
  `${banner("9", "1 teacher + 100 viewers smoke", [
    "Bounded room; measure version/presence; disconnect cleanup; write results artifact.",
    "Decide Socket.IO scale adapter only from evidence — do not pre-add.",
  ])}
import { describe, it, expect } from "vitest";

describe.skip("LOAD-01 100 viewers (Phase 9)", () => {
  it("scaffold", () => {
    expect(true).toBe(true);
  });
});
`,
);

write(
  ".github/workflows/ci.yml",
  `# @scaffold true
# @phase 9 — Hardening CI
# IMPLEMENT: run npm run verify on PR; optional socket-server job; no secrets in logs.
name: ci
on:
  push:
    branches: [main]
  pull_request:
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
      - run: npm ci
      - run: npm --prefix socket-server ci
      - run: npm run verify
`,
);

// Update docs/29 to point at real tree
write(
  "docs/29_FOLDER_STRUCTURE.md",
  `# 29 — Repository Folder Structure (implementation map)

> Generated to match SyncVas v1.0 phases 1–10. Stub files in the repo carry \`@scaffold\` / \`@phase\` header comments describing what to implement. **Do not invent greenfield paths that conflict with these.**

\`\`\`text
/
├─ app/
│  ├─ page.tsx                          # Phase 1 foundation health hub (done)
│  ├─ layout.tsx / globals.css          # Phase 1 shell (done)
│  ├─ teacher/
│  │  ├─ page.tsx                       # Phase 2–6 teacher classroom
│  │  └─ history/page.tsx               # Phase 8 history
│  ├─ student/[sessionId]/page.tsx      # Phase 2–5 student room
│  └─ join/
│     ├─ page.tsx                       # Phase 3 code join
│     └─ [code]/page.tsx                # Phase 3 QR deep link
├─ components/
│  ├─ foundation/                       # Phase 1 health (done)
│  ├─ providers/                        # Phase 1 Convex provider (done)
│  ├─ board/                            # Phase 2 + 4 canvas/sync/viewport
│  ├─ room/                             # Phase 3 create/join/QR/count/end
│  ├─ student/follow-controls.tsx       # Phase 4
│  ├─ doubts/                           # Phase 5 + 7
│  ├─ teacher/end-class-panel.tsx       # Phase 6
│  ├─ export/                           # Phase 8
│  ├─ connection/                       # Phase 8
│  └─ ui/                               # design-system primitives
├─ convex/
│  ├─ schema.ts / health.ts             # Phase 1 (done)
│  ├─ auth.ts                           # Phase 3 helpers
│  ├─ sessions.ts / participants.ts     # Phase 3 (+6/8 sessions)
│  ├─ doubts.ts                         # Phase 5 + 7
│  ├─ board.ts / boardSnapshots.ts      # Phase 6
│  ├─ exports.ts                        # Phase 8
│  ├─ moderation.ts                     # Phase 7
│  ├─ http.ts                           # Phase 10 optional
│  └─ internal/
│     ├─ finalizeBoard.ts               # Phase 6
│     ├─ exportJobs.ts                  # Phase 8
│     └─ moderation.ts                  # Phase 7/10
├─ lib/ai/
│  ├─ moderation-adapter.ts             # Phase 7 contract + disabled
│  └─ providers/index.ts                # Phase 10 live provider
├─ shared/
│  ├─ protocol/socket.ts                # Phase 1+ (extend in 2/4)
│  ├─ constants/limits.ts               # Phase 5/7
│  └─ types/session.ts                  # Phase 3
├─ socket-server/src/
│  ├─ index.ts / server.ts              # Phase 1 ping; extend 2–4
│  ├─ auth.ts / rooms.ts                # Phase 3
│  ├─ protocol.ts / board-hot-state.ts  # Phase 2/4
│  └─ validators.ts                     # shared Zod bridge
├─ tests/                               # describe.skip scaffolds per phase
│  └─ security/ + load/                 # Phase 9
├─ .github/workflows/ci.yml             # Phase 9
└─ docs/ + AGENTS.md                    # product law
\`\`\`

## Phase ownership cheat-sheet

| Phase | Primary paths |
|------:|---------------|
| 1 | \`convex/schema\`, \`shared/protocol\`, foundation health, \`npm run verify\` |
| 2 | \`components/board/*\`, teacher/student pages, socket board handlers, \`tests/board-sync\` |
| 3 | \`convex/auth|sessions|participants\`, \`components/room/*\`, join routes, socket tokens |
| 4 | viewport protocol + \`follow-controls\` + \`use-teacher-viewport\` |
| 5 | \`convex/doubts\`, doubt UI, permission tests |
| 6 | \`convex/board\`, \`internal/finalizeBoard\`, end-class panel |
| 7 | deterministic moderation + \`lib/ai/moderation-adapter\` |
| 8 | exports, history page, connection/reconnect UX |
| 9 | \`tests/security\`, \`tests/load\`, CI, deploy/XP-Pen evidence |
| 10 | \`lib/ai/providers\`, \`convex/internal/moderation\`, env-only secrets |

Restore premature WIP from \`.planning/wip/premature-phase-2-3/\` only when executing Phases 2–3, then replace scaffolds with real implementations.
`,
);

console.log("part2 done");
