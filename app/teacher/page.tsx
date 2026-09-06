/**
 * Teacher classroom shell
 *
 * Phase 3: create/start/end session, join code + QR + participant count,
 * BoardRoom uses Convex-issued SVRT1 token once the room is live.
 *
 * Layout: before a room is live the setup surface owns the page. Once live the
 * board takes the viewport and the controls collapse into a floating dock
 * rendered by TeacherSessionControls into this relatively-positioned column.
 */

"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { useMutation } from "convex/react";

import { BoardRoom } from "@/components/board/board-room";
import {
  TeacherSessionControls,
  type TeacherSessionState,
} from "@/components/room/teacher-session-controls";
import { AppShell } from "@/components/ui/app-shell";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { serializeFinalBoardScene } from "@/lib/final-board-scene";

type LiveBoard = {
  session: TeacherSessionState;
  roomToken: string;
  refreshRoomToken: () => Promise<string>;
};

type LatestScene = {
  scene: unknown;
  boardVersion: number;
};

export default function TeacherPage() {
  const [liveBoard, setLiveBoard] = useState<LiveBoard | null>(null);
  const latestSceneRef = useRef<LatestScene | null>(null);
  const saveFinalBoard = useMutation(api.boardSnapshots.saveFinal);
  const saveFinalBoardLocal = useMutation(api.boardSnapshots.saveFinalAsLocalTeacher);
  const localTeacherEnabled =
    process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ENABLE_LOCAL_TEACHER === "1";

  const onLiveSession = useCallback((session: TeacherSessionState, roomToken: string, refreshRoomToken: () => Promise<string>) => {
    latestSceneRef.current = null;
    setLiveBoard({ session, roomToken, refreshRoomToken });
  }, []);

  const onSceneChange = useCallback((scene: unknown, boardVersion: number) => {
    latestSceneRef.current = { scene, boardVersion };
  }, []);

  const onBeforeEnd = useCallback(
    async (session: TeacherSessionState) => {
      const latest = latestSceneRef.current;
      const input = {
        sessionId: session.sessionId as Id<"sessions">,
        boardVersion: latest?.boardVersion ?? 0,
        sceneJson: serializeFinalBoardScene(latest?.scene),
      };
      if (localTeacherEnabled) await saveFinalBoardLocal(input);
      else await saveFinalBoard(input);
    },
    [localTeacherEnabled, saveFinalBoard, saveFinalBoardLocal],
  );

  const onSessionEnded = useCallback(() => {
    latestSceneRef.current = null;
    setLiveBoard(null);
  }, []);

  const isLive = liveBoard?.session.status === "live";

  return (
    <AppShell
      classroom
      title="Teacher board"
      trailing={
        <div className="flex items-center gap-2">
          <Link href="/teacher/sign-in" className="syncvas-btn syncvas-btn-ghost syncvas-btn-sm">
            Teacher sign in
          </Link>
          <Link href="/teacher/history" className="syncvas-btn syncvas-btn-ghost syncvas-btn-sm">
            History
          </Link>
        </div>
      }
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        <TeacherSessionControls
          onLiveSession={onLiveSession}
          onBeforeEnd={onBeforeEnd}
          onSessionEnded={onSessionEnded}
        />

        <div className="min-h-0 flex-1 p-3 sm:p-4">
          {isLive && liveBoard ? (
            <BoardRoom
              sessionId={liveBoard.session.sessionId}
              role="teacher"
              roomToken={liveBoard.roomToken}
              refreshRoomToken={liveBoard.refreshRoomToken}
              onSceneChange={onSceneChange}
            />
          ) : (
            <div className="grid h-full place-items-center rounded-panel border border-dashed border-border bg-surface-muted/40 px-6 text-center">
              <div className="max-w-sm">
                <p className="text-base font-medium tracking-[-0.02em]">Board waiting</p>
                <p className="mt-2 text-sm leading-6 text-ink-muted">
                  Create and start a room to open the live canvas. Students join with the room
                  code.
                </p>
                <Link
                  href="/student/proof-session"
                  className="mt-4 inline-flex text-sm font-medium text-ink underline-offset-2 hover:underline"
                >
                  Open canvas-only proof
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
