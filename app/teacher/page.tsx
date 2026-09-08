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
import { BoardDraftPanel } from "@/components/ai/board-draft-panel";
import { TeacherDoubtQueue } from "@/components/doubts/teacher-doubt-queue";
import { SaveTemplateButton } from "@/components/templates/save-template-button";
import { TemplateLibrary, type PreparedBoard } from "@/components/templates/template-library";
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
  // Phase 11: the prepared board this class opens on, chosen before it starts.
  const [preparedBoard, setPreparedBoard] = useState<PreparedBoard | null>(null);
  const latestSceneRef = useRef<LatestScene | null>(null);
  // One transactional call: the room can never reach "ending" without its board
  // already durable, which is what used to strand a session in "ending" forever.
  const saveFinalAndEnd = useMutation(api.sessions.saveFinalAndEnd);

  const onLiveSession = useCallback((session: TeacherSessionState, roomToken: string, refreshRoomToken: () => Promise<string>) => {
    latestSceneRef.current = null;
    setLiveBoard({ session, roomToken, refreshRoomToken });
  }, []);

  const onSceneChange = useCallback((scene: unknown, boardVersion: number) => {
    latestSceneRef.current = { scene, boardVersion };
  }, []);

  const onEndSession = useCallback(
    async (session: TeacherSessionState) => {
      const latest = latestSceneRef.current;
      const input = {
        sessionId: session.sessionId as Id<"sessions">,
        boardVersion: latest?.boardVersion ?? 0,
        sceneJson: serializeFinalBoardScene(latest?.scene),
      };
      return await saveFinalAndEnd(input);
    },
    [saveFinalAndEnd],
  );

  const onSessionEnded = useCallback(() => {
    latestSceneRef.current = null;
    setLiveBoard(null);
    setPreparedBoard(null);
  }, []);

  const currentScene = useCallback(() => latestSceneRef.current?.scene ?? null, []);

  const isLive = liveBoard?.session.status === "live";

  return (
    <AppShell
      classroom
      showClassroomHeader={false}
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        <TeacherSessionControls
          onLiveSession={onLiveSession}
          onEndSession={onEndSession}
          onSessionEnded={onSessionEnded}
        />

        <div className="min-h-0 flex-1 p-3 sm:p-4">
          {isLive && liveBoard ? (
            <div className="flex h-full min-h-0 flex-col gap-2">
              <div className="syncvas-teacher-live-header">
                {preparedBoard ? (
                  <p className="syncvas-teacher-live-context">
                    Prepared board · <span>{preparedBoard.title}</span>
                  </p>
                ) : (
                  <p className="syncvas-teacher-live-context">Blank board · ready to teach</p>
                )}
                <div className="syncvas-teacher-live-actions">
                  <TeacherDoubtQueue sessionId={liveBoard.session.sessionId} />
                  <SaveTemplateButton getScene={currentScene} defaultTitle={preparedBoard?.title} />
                </div>
              </div>
              <div className="min-h-0 flex-1">
                <BoardRoom
                  sessionId={liveBoard.session.sessionId}
                  role="teacher"
                  roomToken={liveBoard.roomToken}
                  refreshRoomToken={liveBoard.refreshRoomToken}
                  onSceneChange={onSceneChange}
                  initialScene={preparedBoard?.scene}
                />
              </div>
            </div>
          ) : (
            <div className="grid h-full min-h-[34rem] overflow-hidden rounded-panel border border-border bg-surface-muted/40 lg:grid-cols-[minmax(0,0.78fr)_minmax(22rem,1.12fr)_minmax(0,0.9fr)]">
              <section className="flex flex-col justify-between border-b border-border px-6 py-8 sm:px-8 lg:border-b-0 lg:border-r" aria-labelledby="board-waiting-title">
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-muted">Live room</p>
                  <h2 id="board-waiting-title" className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-ink">
                    Board waiting
                  </h2>
                  <p className="mt-3 max-w-xs text-sm leading-6 text-ink-muted">
                    Create and start a room to open the live canvas. Students join with the room code.
                  </p>
                </div>

                <div className="mt-10 rounded-card border border-border bg-canvas/70 p-4 shadow-soft">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Opening state</p>
                  <p className="mt-2 text-sm leading-6 text-ink-muted">
                    {preparedBoard ? (
                      <>
                        Starting on <span className="font-medium text-ink">{preparedBoard.title}</span>.
                      </>
                    ) : (
                      "A blank board is ready for the next lesson."
                    )}
                  </p>
                  {preparedBoard ? (
                    <button
                      type="button"
                      className="mt-3 text-xs font-medium text-ink underline underline-offset-2"
                      onClick={() => setPreparedBoard(null)}
                    >
                      Use a blank board instead
                    </button>
                  ) : null}
                </div>

                <Link
                  href="/student/proof-session"
                  className="mt-8 inline-flex w-fit text-sm font-medium text-ink underline-offset-2 hover:underline"
                >
                  Open canvas-only proof ↗
                </Link>
              </section>

              <section className="min-w-0 border-b border-border px-6 py-8 sm:px-8 lg:border-b-0 lg:border-r" aria-label="Prepared boards">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-muted">Your library</p>
                  </div>
                  <span className="rounded-full border border-border bg-canvas px-2.5 py-1 text-[0.65rem] font-medium text-ink-muted">Reuse</span>
                </div>
                <TemplateLibrary onOpen={setPreparedBoard} />
              </section>

              <section className="min-w-0 px-6 py-8 sm:px-8" aria-label="AI board draft">
                <div className="mb-5">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-muted">Start from an idea</p>
                </div>
                <BoardDraftPanel />
              </section>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
