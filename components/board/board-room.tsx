/**
 * @phase 2
 * Board room chrome wrapper
 *
 * Compose BoardCanvas + room chrome. Teacher gets tools; student read-only.
 * The board frame, status pills and fullscreen control live in BoardCanvas, so
 * this stays a thin composition point that simply gives the canvas the height.
 *
 * Non-negotiables: teacher-only board edits; no student board mutation;
 * no Yjs/CRDT; no student cursors/chat; no raw HF pen events in Convex;
 * AI only via adapter; validate every public Convex arg + authz.
 */

"use client";

import { BoardCanvas } from "@/components/board/board-canvas";

export type BoardRoomProps = {
  sessionId: string;
  role: "teacher" | "student";
  /** Optional Phase 3+ Convex-issued token; proof mode mints when omitted */
  roomToken?: string;
  refreshRoomToken?: () => Promise<string>;
  /** Local snapshot callback used only when the teacher ends a session. */
  onSceneChange?: (scene: unknown, boardVersion: number) => void;
};

export function BoardRoom({ sessionId, role, roomToken, refreshRoomToken, onSceneChange }: BoardRoomProps) {
  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Classroom board">
      <BoardCanvas
        sessionId={sessionId}
        role={role}
        roomToken={roomToken}
        refreshRoomToken={refreshRoomToken}
        onSceneChange={onSceneChange}
      />
    </section>
  );
}
