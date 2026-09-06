# 00 — Start Here

## Product in one sentence

A classroom companion where a teacher writes naturally with an XP-Pen, every student receives the live board, students can independently explore or follow the teacher, shy students can ask anonymous moderated doubts, and the class ends with a permanent board plus downloadable notes.

## Problem being solved

Traditional projector/screen-share teaching makes every student share one camera. A student who wants to look back at an old derivation cannot move the teacher's view. Students who are nervous about raising a hand often keep doubts to themselves. After class, the board often disappears or survives as bad phone photos.

## MVP promise

1. Teacher creates a live room.
2. Room exposes a short join code and QR.
3. Teacher writes using Excalidraw with stylus/XP-Pen support.
4. Students see updates in near real time.
5. Students are read-only but can pan/zoom locally.
6. Students can toggle Follow Teacher.
7. Students can submit anonymous doubts.
8. Spam/rate limits run before expensive AI.
9. Teacher gets a compact ranked doubt queue.
10. End Class persists the board and produces an export/download path.
11. AI can author a complete lesson, diagrams, explanations, and quizzes for teacher review.

## Non-goals for first release

- multi-teacher simultaneous editing
- student editing/drawing
- audio recording/transcription
- full lecture replay timeline
- attendance product
- LMS replacement
- video conferencing
- public social chat
- complex classroom analytics

## Core implementation principle

Use a boring architecture that matches the workload:

- Convex = durable source of truth and reactive app state.
- Socket.IO = ephemeral high-frequency canvas + viewport broadcast.
- Excalidraw = drawing/editor engine.
- Student local state = local viewport/follow state.

## First coding milestone

Do not start with AI. First prove this loop:

Teacher draws a stroke -> Socket.IO broadcasts -> two student browser windows display it -> each student can pan away independently -> Follow Teacher returns them to teacher viewport.


## AI-first lesson direction

SyncVas supports two AI entry points with one authoring core: the in-app provider-neutral AI adapter and a remote stateless MCP endpoint for ChatGPT/Claude. Both create the same teacher-owned draft; the teacher reviews, edits, and publishes before class. Read `docs/38_AI_LESSON_STUDIO_AND_MCP.md` before changing AI authoring or MCP behavior.
