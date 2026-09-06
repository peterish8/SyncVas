# Syncvas — Solo Dev Starter Pack

This repository pack is the specification set for Syncvas, a classroom-first live whiteboard product.

Core idea: a teacher writes on an XP-Pen/stylus-enabled browser canvas; students join by QR/code, watch the same board in real time, freely pan/zoom without disturbing the teacher, optionally follow the teacher viewport, ask anonymous but moderated doubts, and receive a saved board plus post-class notes/PDF.

## Locked technical direction

- Frontend: Next.js App Router + React + TypeScript
- Styling: Tailwind CSS + shadcn/ui
- Whiteboard: `@excalidraw/excalidraw` (MIT)
- Product database/backend: Convex
- Live board transport: Socket.IO on a persistent Node server
- Teacher auth: abstracted auth layer; Convex Auth is acceptable for prototype but is beta
- Students: anonymous session tokens; no login required in MVP
- Files: Convex File Storage initially
- AI: provider-agnostic adapter invoked from Convex actions
- PDF: server-side generated lecture PDF
- Hosting: web app on Vercel, Convex on Convex Cloud, Socket.IO server on a persistent WebSocket-capable host

## Important architecture invariant

Do **not** stream every pen pointer coordinate through Convex. Convex is the source of truth for durable product state; Socket.IO is the ephemeral low-latency transport for the live board and teacher viewport.

Only the teacher edits the shared board in MVP. Students are read-only viewers. Because there is a single writer, do not introduce Yjs/CRDTs unless multi-editor collaboration is explicitly added later.

## How an AI coding agent should use this pack

1. Read `AGENTS.md`.
2. Read `docs/00_START_HERE.md`.
3. Read PRD + MVP scope before coding.
4. Implement in milestone order from `docs/22_ROADMAP_AND_MILESTONES.md`.
5. Treat `docs/25_ACCEPTANCE_TESTS.md` as the definition of done.
6. Do not silently expand scope.
