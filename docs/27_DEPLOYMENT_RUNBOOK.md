# SyncVas production runbook

## Environment

Set `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_SOCKET_URL`, `SOCKET_INTERNAL_SECRET` (32+ random characters), `ALLOWED_WEB_ORIGINS`, and `NEXT_PUBLIC_APP_URL`. Keep `ALLOW_DEV_TEACHER=0` and proof-token routes disabled in production. Optional moderation uses server-only `MODERATION_API_URL` and `MODERATION_API_KEY`.

## Release checks

Run `npm run lint`, `npm run typecheck`, `npm run test:all`, and `npm run build`. Start the socket server with the same secret and allowed origin list. Confirm the browser bundle contains no private environment variables.

## Classroom smoke

Use one desktop teacher tab and two student tabs: create, start, join by code and QR, draw, refresh one student, follow/free-roam, submit and resolve a doubt, save the final board, end, open history, and request an export. Confirm an ended code is rejected.

## XP-Pen sign-off

On the supported desktop browser, draw slow lines, fast strokes, dots, eraser actions, undo/redo, and a long 45-minute class. Record browser/OS/tablet driver and any dropped-input observations in the release ticket.

The Vercel CLI is required for hosted environment inspection and deployment: `npm i -g vercel`, then `vercel env pull` and `vercel deploy` from the repository.
