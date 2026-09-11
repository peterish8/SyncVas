"use client";

import Link from "next/link";

import { BoardRoom } from "@/components/board/board-room";
import { ClassEndedPanel } from "@/components/connection/class-ended-panel";
import { StudentDoubtComposer } from "@/components/doubts/student-doubt-composer";
import { isClassEndedError } from "@/lib/board-sync-errors";
import { useStoredValue } from "@/lib/client-store";
import { participantStorageKey, roomTokenStorageKey } from "@/lib/local-teacher";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction } from "convex/react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

/** Module scope: `useStoredValue` needs a stable snapshot parser. */
function parseRoomToken(raw: string | null): string | null {
  return raw;
}

const LOADING_TIMEOUT_MS = 12_000;

/** Remounts cleanly whenever the parent leaves/re-enters the loading branch. */
function LoadingWithTimeout({
  ms,
  fallback,
  children,
}: {
  ms: number;
  fallback: ReactNode;
  children: ReactNode;
}) {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), ms);
    return () => window.clearTimeout(timer);
  }, [ms]);
  return timedOut ? fallback : children;
}

export function StudentBoardShell({ sessionId }: { sessionId: string }) {
  const isProofSession = sessionId === "proof-session";

  // sessionStorage is an external system; `undefined` is the server/hydration
  // snapshot and reads as "still resolving".
  const storedToken = useStoredValue<string | null | undefined>({
    storage: "session",
    key: roomTokenStorageKey(sessionId),
    parse: parseRoomToken,
    serverValue: undefined,
  });
  const roomToken = isProofSession ? null : storedToken;
  const participantId = useStoredValue<string | null | undefined>({
    storage: "session",
    key: participantStorageKey(sessionId),
    parse: (raw) => raw,
    serverValue: undefined,
  });
  const issueToken = useAction(api.sessions.issueSocketToken);
  // Set when Convex refuses a fresh token because the class is over. A student
  // who reloads after class still holds the old token, so the board tries to
  // refresh it; without this they would sit on "Connection lost" forever.
  const [classEnded, setClassEnded] = useState(false);
  const refreshRoomToken = useCallback(async () => {
    if (!participantId) throw new Error("Participant admission is unavailable.");
    try {
      const next = await issueToken({
        sessionId: sessionId as Id<"sessions">,
        participantId: participantId as Id<"participants">,
      });
      window.sessionStorage.setItem(roomTokenStorageKey(sessionId), next.token);
      return next.token;
    } catch (error) {
      // The stored token is deliberately kept: on the next reload it leads
      // straight back here instead of to a misleading "Join required".
      if (isClassEndedError(error)) setClassEnded(true);
      throw error;
    }
  }, [issueToken, participantId, sessionId]);

  if (classEnded) {
    return (
      <div className="relative min-h-[24rem] flex-1">
        <ClassEndedPanel role="student" sessionId={sessionId} />
      </div>
    );
  }

  if (roomToken === undefined) {
    return (
      <LoadingWithTimeout
        ms={LOADING_TIMEOUT_MS}
        fallback={
          <div className="grid flex-1 place-items-center gap-4 px-6 text-center">
            <div className="max-w-sm rounded-panel border border-border bg-surface p-6 shadow-soft">
              <p className="text-base font-medium">Taking too long to open this room</p>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                Refresh, or join again with the room code. Direct links need a fresh join.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  className="syncvas-btn syncvas-btn-secondary"
                  onClick={() => window.location.reload()}
                >
                  Refresh
                </button>
                <Link href="/join" className="syncvas-btn syncvas-btn-primary">
                  Enter join code
                </Link>
              </div>
            </div>
          </div>
        }
      >
        <div className="grid flex-1 place-items-center text-sm text-ink-muted" role="status">
          Loading room…
        </div>
      </LoadingWithTimeout>
    );
  }

  if (!isProofSession && !roomToken) {
    return (
      <div className="grid flex-1 place-items-center gap-4 px-6 text-center">
        <div className="max-w-sm rounded-panel border border-border bg-surface p-6 shadow-soft">
          <p className="text-base font-medium">Join required</p>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Join with a room code to enter this class. Direct links need a fresh join.
          </p>
          <Link href="/join" className="syncvas-btn syncvas-btn-primary mt-5 inline-flex">
            Enter join code
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="syncvas-student-workspace">
      <div className="syncvas-student-board-area">
        <BoardRoom
          sessionId={sessionId}
          role="student"
          roomToken={roomToken ?? undefined}
          refreshRoomToken={isProofSession ? undefined : refreshRoomToken}
        />
      </div>
      <aside className="syncvas-student-doubt-rail" aria-label="Anonymous doubts">
        <StudentDoubtComposer sessionId={sessionId} />
      </aside>
    </div>
  );
}
