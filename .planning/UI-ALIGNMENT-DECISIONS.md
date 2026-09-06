# UI Alignment Decisions — 2026-09-05

## Active-board safe zones

The active teacher board is a canvas-first workspace. Excalidraw owns the
top-left menu, top-centre tool rail, top-right library, and bottom undo/help
controls. Syncvas status/version/follow chrome is placed in a single lane below
the native toolbar (`components/board/board-canvas.tsx`). The wrapper is
`pointer-events: none`; only the fullscreen action opts back into pointer input.
This keeps stylus drawing and native toolbar actions available.

Degraded room-token errors use a dedicated `syncvas-board-alert` at the
bottom-right, positioned above Excalidraw's help control. The alert includes a
warning icon, truncates long copy, and remains pointer-transparent so it never
blocks drawing.

## Live room disclosure

`RoomDock` in `components/room/teacher-session-controls.tsx` is icon-first while
the room is live or ending. The bottom-centre trigger is a 48px circular control
with an accessible label and a small live indicator. Clicking it expands
`syncvas-room-panel`, which contains the room code, state, participant count, QR
presentation, export actions, and quiet End room action. Escape and the collapse
button close the panel and restore focus to the trigger.

The panel is constrained by viewport height and scrolls internally when needed;
the board remains full-height behind it. QR presentation continues to use the
existing modal and fullscreen stage so the code can be scanned from a distance.

## Styling contract

New active-board styles live in `app/styles/components.css` and use the existing
semantic token layer: curved panel geometry, tactile raised control physics,
restrained translucent surface treatment, and no decorative layers over the
drawable paper. Do not put status chips over Excalidraw's native toolbar in
future changes. If new board actions are added, place them in the reserved
Syncvas lane or in the expandable room panel and document the safe zone here.

## Verification

- TypeScript strict check: `node node_modules/typescript/bin/tsc --noEmit --incremental false`
- ESLint direct CLI check for changed components: `node node_modules/eslint/bin/eslint.js components/board/board-canvas.tsx components/room/teacher-session-controls.tsx`
- Formatting/whitespace: `git diff --check`
