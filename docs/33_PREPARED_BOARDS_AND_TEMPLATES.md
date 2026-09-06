# 33 — Prepared Boards and Templates

Phase 11. Requirements PREP-01..05.

## Goal

A teacher builds a board before class — diagrams placed, questions anchored, whitespace left
where they intend to write live — saves it, and starts a session that opens on that board.

## Core rule

A prepared board is not a new transport. The teacher's client loads the template scene, pushes
it into Excalidraw, and publishes it as board version 1 over the existing `board:update`.
Students receive it through the same `board:current` bootstrap that already serves late
joiners. **No student-side code changes and no new socket events.**

## `boardTemplates`

Teacher-owned, reusable across sessions. Deliberately not a `boardSnapshots` row: snapshots
belong to exactly one session, templates outlive sessions and are used many times. Forcing
them together would mean a nullable `sessionId` and a `kind` union doing two unrelated jobs.

Fields:
- `teacherId: Id<"users">`
- `title: string`
- `subject?: string`
- `sceneJson: string`
- `blockSources?: string` — grammar sources for re-render, once v1.1 blocks exist
- `origin: "authored" | "ai-assisted"`
- `createdAt: number`
- `updatedAt: number`

Indexes:
- `by_teacher_updated` — `["teacherId", "updatedAt"]`

Share the scene validator with `convex/boardSnapshots.ts` (900 KB bound, must parse as an
object with an `elements` array). Share the function, not the table.

## Functions

Public, all owner-checked via `requireSessionOwner`-style authorization:
- `templates.saveFromBoard(title, subject?, sceneJson)` → `templateId`
- `templates.listMine()` → templates for the calling teacher only
- `templates.get(templateId)` — refuses a template owned by another teacher
- `templates.rename(templateId, title)`
- `templates.remove(templateId)`
- `sessions.createFromTemplate(templateId, title?, subject?)` → returns the session plus its
  `sceneJson`, so the client can seed the canvas before publishing version 1

`listMine` must use `by_teacher_updated`. No full-table scan on a production path.

## Start-from-template sequence

1. Teacher picks a template; `sessions.createFromTemplate` creates a draft session and returns
   the scene
2. `sessions.start` (or `startAsLocalTeacher`) moves it to `live`
3. Teacher client calls `excalidrawAPI.updateScene()` with the prepared elements
4. Teacher client publishes `board:update` at `boardVersion: 1`
5. Relay stores it in hot state; students bootstrap with `board:current` as normal

Step 4 is the only place ordering matters: publish after the session is live and the socket is
connected, or the update is dropped by the existing disconnected-publish guard.

## Editability

Prepared elements carry no lock flag. Everything on a prepared board is a normal Excalidraw
element the teacher can move, resize, restyle or delete during class. This is the point — the
prepared board is a starting position, not a slide.

## Writing zones

A writing zone is simply a rectangular region the layout function left empty. It is not an
element and is not persisted as one. See `docs/34_AI_BOARD_AUTHORING.md` for how generated
boards reserve them; a hand-authored template reserves space by the teacher leaving space.

## Limits

- Template scene bound: same 900 KB as `boardSnapshots`
- Templates per teacher: cap at 200 and surface a clear message at the limit
- Title: 120 chars, subject 80 — same normalization as `sessions`

## Failure modes

| Case | Behavior |
|------|----------|
| Template deleted while a session is being created | Creation fails with `TEMPLATE_NOT_FOUND`; no partial session left behind |
| Scene fails validation on save | `INVALID_SCENE`, template not written |
| Scene exceeds the byte bound | `SCENE_TOO_LARGE`, template not written |
| Another teacher's template id supplied | `FORBIDDEN`, no existence disclosure beyond that |
| Publish of version 1 fails (socket down) | Scene stays on the teacher canvas; existing pending-scene logic republishes on reconnect |

## Acceptance

1. Save the current board as a template; it appears in the teacher's list and not in another teacher's
2. Start a class from it; the board opens with the prepared scene
3. Two students join and see the prepared scene without any student-side change
4. Teacher moves and edits prepared elements during class
5. Ending the class persists the final board, prepared content included
