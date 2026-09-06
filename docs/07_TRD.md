# 07 — Technical Requirements Document (TRD)

## Stack

- TypeScript
- Next.js App Router
- React
- Tailwind CSS
- shadcn/ui
- `@excalidraw/excalidraw`
- Convex DB/functions/storage
- Socket.IO server/client
- Zod (or equivalent runtime validation) for socket payloads
- server-side PDF generation library chosen during implementation

## Runtime boundaries

### Browser
- renders Excalidraw
- handles stylus input
- computes local student camera state
- sends teacher scene updates to socket server
- subscribes to Convex product state

### Convex
- teacher/user records
- class/session lifecycle
- participant/session pseudonyms
- doubt records/votes/moderation status
- final/periodic board snapshot metadata
- exports/summary status
- rate limits and durable workflow scheduling
- AI actions

### Socket service
- validates room/token handshake
- accepts board updates only from teacher role
- keeps hot room current-scene cache where practical
- broadcasts board updates
- broadcasts teacher viewport as ephemeral/volatile state
- tracks socket presence

## Board consistency model

Single canonical writer: teacher.

Board stream events contain a monotonically increasing `boardVersion` for the session. Students ignore older versions. Late joiners request current scene. Durable snapshots periodically capture current Excalidraw scene.

Viewport stream is not durable and does not increment board version.

## Security boundary

The socket server must not trust client-supplied role. A server-issued room token/claim must identify:
- session ID
- participant or teacher ID
- role
- expiry

Convex or a trusted backend endpoint issues the token.

## Availability behavior

If Convex is available but socket service fails, room/doubts may still load but live board is degraded. If socket is available but Convex is unavailable, new room authentication/lifecycle operations should fail closed; existing connected viewers may temporarily continue receiving ephemeral board updates.

## Versioning

All socket payloads include protocol version `v: 1`. Breaking changes create a new event version or protocol version.
