/**
 * One-shot generator: writes end-to-end SyncVas codebase stubs with phase
 * implementation comments. Safe to re-run — skips existing non-empty files
 * unless FORCE=1. Does not touch .planning/.
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
  fs.writeFileSync(abs, content.replace(/^\uFEFF/, ""), "utf8");
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
    ` * Non-negotiables: teacher-only board edits; no student board mutation;`,
    ` * no Yjs/CRDT; no student cursors/chat; no raw HF pen events in Convex;`,
    ` * AI only via adapter; validate every public Convex arg + authz.`,
    ` */`,
    ``,
  ].join("\n");

// ─── app routes ─────────────────────────────────────────────────────────────

write(
  "app/teacher/page.tsx",
  `${banner("2→6", "Teacher classroom shell", [
    "Phase 2: mount BoardRoom in teacher role; proof session id OK until Phase 3.",
    "Phase 3: create/end session, show join code + QR + live participant count.",
    "Phase 5: dock TeacherDoubtQueue (anonymous).",
    "Phase 6: EndClassPanel → finalize durable final scene.",
    "Phase 8: connection chip + export status entry points.",
  ])}
import Link from "next/link";
import { BoardRoom } from "@/components/board/board-room";

export default function TeacherPage() {
  // PHASE 2: replace proof session with real Convex session id (Phase 3).
  const proofSessionId = "proof-session";

  return (
    <main className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold">Teacher board</h1>
        <Link href="/" className="text-sm text-ink-muted underline">
          Home
        </Link>
      </header>
      {/* PHASE 3: CreateSessionForm / EndSessionButton / ParticipantCount / JoinQr */}
      {/* PHASE 5: TeacherDoubtQueue */}
      {/* PHASE 6: EndClassPanel */}
      <div className="min-h-0 flex-1">
        <BoardRoom sessionId={proofSessionId} role="teacher" />
      </div>
    </main>
  );
}
`,
);

write(
  "app/student/[sessionId]/page.tsx",
  `${banner("2→5", "Student read-only classroom", [
    "Phase 2: BoardRoom role=student; request board:current on connect; local pan/zoom only.",
    "Phase 3: join only via signed room token after Convex join; no student name.",
    "Phase 4: FollowControls — follow / free-roam / return; manual pan exits follow locally.",
    "Phase 5: StudentDoubtComposer — anonymous by default.",
  ])}
import Link from "next/link";
import { BoardRoom } from "@/components/board/board-room";
import { FollowControls } from "@/components/student/follow-controls";
import { StudentDoubtComposer } from "@/components/doubts/student-doubt-composer";

type Props = { params: Promise<{ sessionId: string }> };

export default async function StudentSessionPage({ params }: Props) {
  const { sessionId } = await params;

  return (
    <main className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold">Student board</h1>
        <Link href="/join" className="text-sm text-ink-muted underline">
          Join another
        </Link>
      </header>
      <FollowControls />
      <div className="min-h-0 flex-1">
        <BoardRoom sessionId={sessionId} role="student" />
      </div>
      <StudentDoubtComposer sessionId={sessionId} />
    </main>
  );
}
`,
);

write(
  "app/join/page.tsx",
  `${banner("3", "Anonymous join by short code", [
    "Implement JoinCodeForm → Convex joinParticipant → redirect to /student/[sessionId].",
    "Never collect student name/email. Reject non-live sessions.",
    "QR deep links also land via /join/[code].",
  ])}
import Link from "next/link";
import { JoinCodeForm } from "@/components/room/join-code-form";

export default function JoinPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Join class</h1>
      <p className="text-sm text-ink-muted">
        Enter the 6-character code. No account needed.
      </p>
      <JoinCodeForm />
      <Link href="/" className="text-sm underline">
        Back
      </Link>
    </main>
  );
}
`,
);

write(
  "app/join/[code]/page.tsx",
  `${banner("3", "QR / deep-link join", [
    "Same join path as short code — resolve code → live session → student route.",
    "Must produce identical room membership as /join form.",
  ])}
import { JoinCodeForm } from "@/components/room/join-code-form";

type Props = { params: Promise<{ code: string }> };

export default async function JoinByCodePage({ params }: Props) {
  const { code } = await params;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Join class</h1>
      <JoinCodeForm initialCode={code} />
    </main>
  );
}
`,
);

write(
  "app/teacher/history/page.tsx",
  `${banner("8", "Teacher class history", [
    "List ended sessions owned by teacher (indexed by_teacher_started / status).",
    "Link to reopen final board + export status. Empty/error states required.",
  ])}
import Link from "next/link";

export default function TeacherHistoryPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Class history</h1>
      <p className="mt-2 text-sm text-ink-muted">
        {/* PHASE 8: query ended sessions for current teacher */}
        History scaffold — implement in Phase 8.
      </p>
      <Link href="/teacher" className="mt-6 inline-block text-sm underline">
        Back to live class
      </Link>
    </main>
  );
}
`,
);

// ─── components/board ───────────────────────────────────────────────────────

write(
  "components/board/board-room.tsx",
  `${banner("2", "Board room chrome wrapper", [
    "Compose BoardCanvas + room chrome. Teacher gets tools; student read-only.",
    "Do not use raw <a href=\"/\"> — use next/link.",
    "Phase 3+: pass signed socket token, not spoofable role from query string.",
  ])}
"use client";

import Link from "next/link";
import { BoardCanvas } from "@/components/board/board-canvas";

export type BoardRoomProps = {
  sessionId: string;
  role: "teacher" | "student";
};

export function BoardRoom({ sessionId, role }: BoardRoomProps) {
  return (
    <section className="flex h-full min-h-[60vh] flex-col">
      <div className="flex items-center justify-between px-3 py-2 text-xs text-ink-muted">
        <span>
          session:{sessionId} · {role}
        </span>
        <Link href="/" className="underline">
          Exit
        </Link>
      </div>
      <div className="min-h-0 flex-1">
        <BoardCanvas sessionId={sessionId} role={role} />
      </div>
    </section>
  );
}
`,
);

write(
  "components/board/board-canvas.tsx",
  `${banner("2+4", "Excalidraw canvas + socket sync", [
    "Phase 2 IMPLEMENT:",
    "  - dynamic import @excalidraw/excalidraw (ssr:false); real container height",
    "  - teacher: onChange → throttle → board:update (versioned Zod envelope)",
    "  - student: viewModeEnabled / no mutate tools; never emit board:update",
    "  - on connect: board:request-current; apply only newer versions; gap → resync",
    "  - guard applyingRemote so remote apply does not rebroadcast",
    "  - student pan/zoom stays in LOCAL React state only",
    "Phase 4 IMPLEMENT:",
    "  - teacher coalesce teacher:viewport ~10–15/s",
    "  - student follow applies teacher viewport; manual pan exits follow locally",
    "NEVER persist pointer streams to Convex. NEVER use refs during render.",
  ])}
"use client";

export type BoardCanvasProps = {
  sessionId: string;
  role: "teacher" | "student";
};

export function BoardCanvas({ sessionId, role }: BoardCanvasProps) {
  return (
    <div
      className="grid h-full min-h-[480px] place-items-center rounded-md border border-dashed border-border bg-white text-sm text-ink-muted"
      data-session={sessionId}
      data-role={role}
      data-phase="2"
    >
      {/* PHASE 2: mount Excalidraw + useBoardSync here */}
      Excalidraw canvas scaffold ({role}) — implement in Phase 2
    </div>
  );
}
`,
);

write(
  "components/board/use-board-sync.ts",
  `${banner("2", "Board socket sync hook", [
    "Connect Socket.IO with room token (Phase 3+).",
    "Teacher: emit board:update with SOCKET_PROTOCOL_VERSION + scene + version.",
    "Student: listen board:current / board:update; ignore older versions.",
    "Server rejects student board:update — client must still not send them.",
    "Keep latest applied version in a ref; never write HF pointers to Convex.",
  ])}
"use client";

export type BoardSyncRole = "teacher" | "student";

export function useBoardSync(_args: {
  sessionId: string;
  role: BoardSyncRole;
  /** Phase 3+: short-lived signed admission token */
  roomToken?: string;
}) {
  // PHASE 2: return { status, latestVersion, publishScene, requestCurrent }
  return {
    status: "scaffold" as const,
    latestVersion: 0,
    publishScene: (_scene: unknown) => {
      /* teacher only */
    },
    requestCurrent: () => {
      /* student late-join */
    },
  };
}
`,
);

write(
  "components/board/use-teacher-viewport.ts",
  `${banner("4", "Teacher viewport stream + student follow", [
    "Teacher: coalesce scrollX/scrollY/zoom → teacher:viewport.",
    "Student: followEnabled applies remote viewport; pan/zoom sets followEnabled=false locally.",
    "Return-to-teacher reapplies last teacher viewport. Never put camera in Convex.",
    "Dropped packets must not corrupt board scene content.",
  ])}
"use client";

export function useTeacherViewport(_args: {
  sessionId: string;
  role: "teacher" | "student";
  roomToken?: string;
}) {
  // PHASE 4: wire follow state + viewport apply helpers
  return {
    followEnabled: false,
    setFollowEnabled: (_v: boolean) => {},
    lastTeacherViewport: null as null | {
      scrollX: number;
      scrollY: number;
      zoom: number;
    },
    onLocalPanZoom: () => {
      /* exits follow locally */
    },
  };
}
`,
);

// ─── components/room ────────────────────────────────────────────────────────

write(
  "components/room/create-session-form.tsx",
  `${banner("3", "Teacher create live session", [
    "Call Convex sessions.create; show joinCode; start socket admission.",
    "Validate title; ownership from auth subject — never client teacherId.",
  ])}
"use client";

export function CreateSessionForm() {
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        // PHASE 3: createSession mutation
      }}
    >
      <label className="text-sm">
        Class title
        <input className="mt-1 w-full rounded border px-2 py-1" name="title" />
      </label>
      <button type="submit" className="rounded bg-ink px-3 py-2 text-sm text-white">
        Start class
      </button>
    </form>
  );
}
`,
);

write(
  "components/room/join-code-form.tsx",
  `${banner("3", "Student join by code", [
    "Normalize 6-char code → participants.join → navigate /student/[sessionId].",
    "No name field. Show clear errors for ended/invalid codes.",
  ])}
"use client";

export function JoinCodeForm({ initialCode = "" }: { initialCode?: string }) {
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        // PHASE 3: join by code
      }}
    >
      <label className="text-sm">
        Join code
        <input
          className="mt-1 w-full rounded border px-2 py-1 uppercase tracking-widest"
          name="code"
          defaultValue={initialCode}
          maxLength={6}
          autoComplete="off"
        />
      </label>
      <button type="submit" className="rounded bg-ink px-3 py-2 text-sm text-white">
        Join
      </button>
    </form>
  );
}
`,
);

write(
  "components/room/join-qr.tsx",
  `${banner("3", "QR for /join/[code]", [
    "Render QR pointing at absolute /join/{joinCode} URL.",
    "Same membership path as typed code.",
  ])}
"use client";

export function JoinQr({ joinCode }: { joinCode: string }) {
  return (
    <div className="rounded border border-dashed p-4 text-center text-sm text-ink-muted">
      {/* PHASE 3: QR library or API */}
      QR for code {joinCode || "———"}
    </div>
  );
}
`,
);

write(
  "components/room/participant-count.tsx",
  `${banner("3", "Live coarse participant count", [
    "Reactive Convex query by_session OR socket room:presence — room-scoped only.",
    "Do not show student identities.",
  ])}
"use client";

export function ParticipantCount({ sessionId }: { sessionId: string }) {
  return (
    <span className="text-sm text-ink-muted" data-session={sessionId}>
      {/* PHASE 3 */}0 students
    </span>
  );
}
`,
);

write(
  "components/room/end-session-button.tsx",
  `${banner("3+6", "End class control", [
    "Phase 3: mark session ending/ended; reject new joins.",
    "Phase 6: trigger finalization pipeline (capture final scene once).",
  ])}
"use client";

export function EndSessionButton({ sessionId }: { sessionId: string }) {
  return (
    <button
      type="button"
      className="rounded border px-3 py-1 text-sm"
      onClick={() => {
        void sessionId;
        // PHASE 3/6
      }}
    >
      End class
    </button>
  );
}
`,
);

// ─── components/student, doubts, teacher, export, connection ────────────────

write(
  "components/student/follow-controls.tsx",
  `${banner("4", "Follow Teacher / free-roam UI", [
    "Accessible text state: Following | Free roam — not color alone.",
    "Toggle follow; Return to Teacher; keyboard reachable.",
  ])}
"use client";

export function FollowControls() {
  return (
    <div className="flex items-center gap-2 border-b px-3 py-2 text-sm">
      <span>Follow: Free roam (scaffold)</span>
      <button type="button" className="rounded border px-2 py-1 text-xs">
        Follow Teacher
      </button>
      <button type="button" className="rounded border px-2 py-1 text-xs">
        Return to Teacher
      </button>
    </div>
  );
}
`,
);

write(
  "components/doubts/student-doubt-composer.tsx",
  `${banner("5", "Anonymous doubt composer", [
    "Max 220 chars; rate-limit feedback without AI.",
    "Explain anonymity in UI copy. Never send identity fields.",
  ])}
"use client";

export function StudentDoubtComposer({ sessionId }: { sessionId: string }) {
  return (
    <form
      className="border-t p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void sessionId;
        // PHASE 5: doubts.submit
      }}
    >
      <label className="block text-sm">
        Ask anonymously
        <textarea className="mt-1 w-full rounded border p-2 text-sm" maxLength={220} rows={2} />
      </label>
      <button type="submit" className="mt-2 rounded bg-ink px-3 py-1 text-sm text-white">
        Send doubt
      </button>
    </form>
  );
}
`,
);

write(
  "components/doubts/teacher-doubt-queue.tsx",
  `${banner("5+7", "Teacher anonymous doubt queue", [
    "Phase 5: reactive list; answer/dismiss; same-doubt vote count; no student names.",
    "Phase 7: show screening reason / uncertain / duplicate suggestions (advisory).",
    "Never log raw doubt text in client telemetry.",
  ])}
"use client";

export function TeacherDoubtQueue({ sessionId }: { sessionId: string }) {
  return (
    <aside className="w-80 border-l p-3 text-sm" data-session={sessionId}>
      <h2 className="font-semibold">Doubts</h2>
      <p className="mt-2 text-ink-muted">Queue scaffold — Phase 5</p>
    </aside>
  );
}
`,
);

write(
  "components/doubts/doubt-vote-button.tsx",
  `${banner("5", "Same-doubt vote (once per participant)", [
    "Convex doubtVotes unique per participant+doubt; reject duplicates.",
  ])}
"use client";

export function DoubtVoteButton({
  doubtId,
  voteCount,
}: {
  doubtId: string;
  voteCount: number;
}) {
  return (
    <button
      type="button"
      className="rounded border px-2 py-0.5 text-xs"
      onClick={() => {
        void doubtId;
        // PHASE 5
      }}
    >
      Same doubt ({voteCount})
    </button>
  );
}
`,
);

write(
  "components/teacher/end-class-panel.tsx",
  `${banner("6", "End-class finalization UX", [
    "Confirm → live→ending→ended; capture canonical scene once to _storage.",
    "Show progress/failure with retry; never lose active scene on soft failure.",
  ])}
"use client";

export function EndClassPanel({ sessionId }: { sessionId: string }) {
  return (
    <div className="rounded border p-3 text-sm" data-session={sessionId}>
      End-class panel scaffold — Phase 6
    </div>
  );
}
`,
);

write(
  "components/export/export-actions.tsx",
  `${banner("8", "Request image/PDF export", [
    "Owner-only; queue export job from durable final scene; show status link.",
  ])}
"use client";

export function ExportActions({ sessionId }: { sessionId: string }) {
  return (
    <button type="button" className="rounded border px-3 py-1 text-sm" onClick={() => void sessionId}>
      Export board (Phase 8)
    </button>
  );
}
`,
);

write(
  "components/export/export-status.tsx",
  `${banner("8", "Export job state chip", [
    "queued | processing | ready | failed — reactive from Convex exports table.",
  ])}
"use client";

export function ExportStatus({ sessionId }: { sessionId: string }) {
  return (
    <span className="text-xs text-ink-muted" data-session={sessionId}>
      Export: —
    </span>
  );
}
`,
);

write(
  "components/connection/connection-chip.tsx",
  `${banner("8", "Degraded connection indicator", [
    "Show only when socket degraded/reconnecting — not during healthy class.",
  ])}
"use client";

export function ConnectionChip({ state }: { state: "ok" | "degraded" | "offline" }) {
  if (state === "ok") return null;
  return <span className="rounded bg-amber-100 px-2 py-0.5 text-xs">{state}</span>;
}
`,
);

write(
  "components/connection/reconnect-banner.tsx",
  `${banner("8", "Reconnect / resync UX", [
    "On reconnect: refresh token → rejoin room → board:request-current → reconcile version.",
    "Do not replay student local edits as teacher. Preserve follow/free-roam choice.",
  ])}
"use client";

export function ReconnectBanner({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="bg-amber-50 px-3 py-2 text-sm">
      Connection issue.{" "}
      <button type="button" className="underline" onClick={onRetry}>
        Reconnect
      </button>
    </div>
  );
}
`,
);

write(
  "components/ui/.gitkeep",
  `# shadcn/ui primitives land here as needed — keep product chrome warm-neutral (docs/06).\n`,
);

console.log("app/components batch done");
