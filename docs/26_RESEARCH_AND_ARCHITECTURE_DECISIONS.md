# 26 — Research and Architecture Decisions

This document records why the starter pack makes its major choices. Verify APIs against current official docs during implementation.

## Excalidraw

Chosen because its repository/package is MIT licensed and designed to be embedded as a React component. Official integration guidance notes client-side/Next.js concerns, CSS/parent sizing, and package installation.

Decision: use as drawing engine, not as product identity.

## Convex

Chosen by product owner for database/backend. Convex queries are reactive/realtime; mutations are transactional; actions can call external APIs. This is appropriate for sessions, doubts, votes, exports and AI workflows.

Decision: do not misuse database reactivity as a raw pen transport.

## Socket.IO

Chosen for bidirectional low-latency room broadcasting with reconnection support and an easy Node/TypeScript development model.

Decision: single persistent socket service for MVP.

## No Yjs/CRDT

Reason: only teacher writes. There are no concurrent editor conflicts. Revisit only if multiple editors become a real product requirement.

## Convex Auth caveat

Official docs currently mark Convex Auth beta and note Next.js server-side support is evolving. Keep auth integration abstracted.

## File storage caveat

Convex-generated file URLs act like bearer URLs. Access checks happen before returning URLs; if later requirements need expiring/revocable links without deleting files, revisit storage/delivery architecture.

## Source links

- Convex docs: https://docs.convex.dev/
- Convex realtime: https://docs.convex.dev/realtime
- Convex functions: https://docs.convex.dev/functions/overview
- Convex schemas: https://docs.convex.dev/database/schemas
- Convex indexes: https://docs.convex.dev/database/reading-data/indexes/
- Convex best practices: https://docs.convex.dev/understanding/best-practices
- Convex file storage: https://docs.convex.dev/file-storage/overview
- Convex Auth: https://docs.convex.dev/auth/convex-auth
- Excalidraw developer docs: https://docs.excalidraw.com/
- Excalidraw package README: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/README.md
- Excalidraw license: https://github.com/excalidraw/excalidraw/blob/master/LICENSE
- Socket.IO: https://socket.io/
- Next.js docs: https://nextjs.org/docs
