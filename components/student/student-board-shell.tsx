"use client";

import Link from "next/link";

import { BoardRoom } from "@/components/board/board-room";
import { StudentDoubtComposer } from "@/components/doubts/student-doubt-composer";
import { useStoredValue } from "@/lib/client-store";
import { participantStorageKey, roomTokenStorageKey } from "@/lib/local-teacher";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction } from "convex/react";
import { useCallback } from "react";

/** Module scope: `useStoredValue` needs a stable snapshot parser. */
function parseRoomToken(raw: string | null): string | null {
  return raw;
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
  const refreshRoomToken = useCallback(async () => {
    if (!participantId) throw new Error("Participant admission is unavailable.");
    const next = await issueToken({
      sessionId: sessionId as Id<"sessions">,
      participantId: participantId as Id<"participants">,
    });
    window.sessionStorage.setItem(roomTokenStorageKey(sessionId), next.token);
    return next.token;
  }, [issueToken, participantId, sessionId]);

  if (roomToken === undefined) {
    return (
      <div className="grid flex-1 place-items-center text-sm text-ink-muted">Loading room…</div>
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
    <>
      <div className="min-h-0 flex-1 p-3 sm:p-4">
        <div className="h-full min-h-0">
          <BoardRoom
            sessionId={sessionId}
            role="student"
            roomToken={roomToken ?? undefined}
            refreshRoomToken={isProofSession ? undefined : refreshRoomToken}
          />
        </div>
      </div>
      <div className="shrink-0">
        <StudentDoubtComposer sessionId={sessionId} />
      </div>
    </>
  );
}
