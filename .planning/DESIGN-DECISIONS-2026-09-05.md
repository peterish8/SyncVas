# Decision record — CSS consolidation + teacher board redesign

**Date:** 2026-09-05
**Scope:** frontend only. No Convex schema, Socket.IO protocol, or MVP rule changed.

## Why

`app/globals.css` had grown to 957 lines carrying four parallel class systems.
An audit of every selector against every `.tsx` found:

| Prefix | Selectors defined | Usages in `.tsx` | Verdict |
|---|---|---|---|
| `origin-*` | 50 | 44 (`app/page.tsx`) | live — marketing |
| `syncvas-*` | 14 | 35 (product) | live — product |
| `landing-*` | 61 | 0 | **dead** |
| `landing-v2-*` | 41 (declared 3×) | 0 | **dead** |
| `tactile-*` | 4 | 0 | **dead** |

~62% of the stylesheet was unreachable, and radii were being written as
one-off arbitrary values (`rounded-[1.25rem]`, `rounded-[1.35rem]`,
`rounded-[1.5rem]`, `rounded-2xl`) rather than coming from a scale.

## Decisions

1. **Three-layer token architecture** (`app/styles/tokens.css`):
   primitives (`--sv-*`) → semantic roles → dark theme. Components may only
   reference semantic names. This is the mechanism that makes one edit
   propagate everywhere, which was the explicit requirement.
2. **Four style layers** imported by a ~70-line `app/globals.css`:
   `tokens` / `base` / `components` / `landing`. Dead systems deleted.
   Backup of the pre-consolidation file: `.planning/globals.css.pre-consolidation.bak`.
3. **One radius scale** (6/10/14/20/28/36/pill) exposed to Tailwind as
   `rounded-icon|control|card|panel|surface|feature`. All arbitrary radii in
   `.tsx` were replaced; none remain.
4. **One tactile recipe** (`--tactile-raised`) with per-variant colour slots, so
   button physics is defined once rather than repeated per variant.
5. **Teacher setup collapses to a dock once live.** The board becomes the
   product; room status, code, participants, QR, export and End room stay one
   click away behind a `Room` disclosure.
6. **QR moved out of the setup layout** into a compact trigger + standalone
   overlay with a fullscreen presentation mode.
7. **End room uses a new `danger-quiet` variant** — unmistakably destructive,
   not visually dominant.
8. **Board overlay zoning**: Excalidraw owns its toolbar, library and both
   bottom corners; all Syncvas chrome lives in one top-left column, hidden
   below `sm` where Excalidraw's mobile toolbar takes that space.

## Also fixed in this pass

- 13 ESLint `react-hooks` errors (the standing `.planning/STATE.md` todo).
  `set-state-in-effect` was resolved by treating web storage as an external
  store (`lib/client-store.ts`, `useSyncExternalStore`) rather than copying it
  into state in an effect; `refs-during-render` by moving latest-callback ref
  writes into effects. `board-canvas.tsx`'s own header already required this
  ("NEVER use refs during render") and the code was violating it.
- Six Convex/permission test suites were still `describe.skip` scaffolds. Two
  are now implemented (`tests/doubts-permissions.test.ts`,
  `tests/final-board.test.ts`) against a small in-memory Convex fake
  (`tests/helpers/fake-convex.ts`). Suite count went 25 → 50 passing.

## Files changed

**Styles:** `app/globals.css` (957→71 lines), `app/styles/{tokens,base,components,landing}.css` (new)
**Components:** `components/ui/modal.tsx` (new), `components/room/join-qr.tsx`,
`components/room/teacher-session-controls.tsx`, `components/board/board-canvas.tsx`,
`components/board/board-room.tsx`, `components/ui/theme-toggle.tsx`,
`components/student/student-board-shell.tsx`, `components/room/participant-count.tsx` (unchanged),
`components/export/export-actions.tsx`, `components/room/end-session-button.tsx`
**Pages:** `app/teacher/page.tsx`, `app/join/page.tsx`, `app/join/[code]/page.tsx`,
`app/teacher/history/page.tsx`, `app/student/[sessionId]/page.tsx`
**Lib:** `lib/client-store.ts` (new), `lib/local-teacher.ts`
**Tests:** `tests/helpers/fake-convex.ts` (new), `tests/doubts-permissions.test.ts`,
`tests/final-board.test.ts`
**Docs:** `docs/06_DESIGN_SYSTEM.md`

## Validation actually performed

Automated, all passing:
- `npm run lint` — clean (was 13 errors, 2 warnings)
- `npm run typecheck` — clean (app + socket-server)
- `npm run test` — 50 passed, 4 skipped
- `npm --prefix socket-server run test` — 3 passed
- `npm run build` — succeeds, 13 routes

Manual browser pass against `http://localhost:3000` with Next dev, socket-server
(:4001) and the local Convex backend (:3210) running:
- teacher bootstrap → create room → start room (code `TJYNBJ`)
- setup surface collapses; board fills the viewport; dock appears
- QR overlay opens, renders the code + join URL, Escape closes it and returns
  focus to the trigger
- Room disclosure expands to code/status/participants/QR/export/End room
- student joined via `/join/TJYNBJ` in a second tab; student board is read-only
  (no Excalidraw editing toolbar) and reports `connected`
- teacher participant count updated to "1 student"
- browser console clean — no errors; one benign HMR websocket warning
- mobile (375×812): setup surface verified; dock wrap and QR icon-collapse
  verified in compiled CSS

## Not verified / still pending

- **Drawing sync was not exercised** in this pass — no stroke was drawn, so
  teacher→student board propagation and follow-mode were not re-confirmed
  visually after the redesign. The socket contract is unchanged and
  `tests/board-sync.test.ts` + `tests/follow-mode.test.ts` still pass.
- **Mobile dock at runtime** was confirmed from compiled CSS, not a screenshot;
  the browser pane closed before the live re-check.
- **The three runtime issues in the original brief**: the console was clean and
  the Excalidraw mount warning did not reproduce (`board-canvas.tsx` already
  carries a two-frame mount guard for it). The "1 Issue" indicator and the
  proof-session Convex validation error were **not reproduced**, so nothing was
  changed for them — if they persist, they need a reproduction.
- Dark theme was not visually swept after the token rewrite.
- No XP-Pen / projector / production-deploy verification.
