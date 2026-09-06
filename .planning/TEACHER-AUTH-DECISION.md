# Teacher authentication decision — 2026-09-06

## Decision

Syncvas now has a dedicated `/teacher/sign-in` entry page. The page establishes the teacher
access flow and keeps the Google provider surface ready without claiming that OAuth works before
credentials are configured.

## Current behavior

- Google sign-in is visibly disabled until the provider integration is configured.
- Local teacher continuation links to the existing development-only bootstrap.
- The teacher board links back to the sign-in entry point.
- Students continue to join without an account.

## Activation contract

Before enabling Google OAuth, implement the server callback and Convex identity bridge, then set:

- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `AUTH_CALLBACK_URL`
- a production `AUTH_SECRET`
- `ALLOW_DEV_TEACHER=0` in production

Never expose `AUTH_GOOGLE_SECRET` or the signing secret through a `NEXT_PUBLIC_*` variable. The
Convex `requireTeacher` helper remains the authorization boundary for session mutations.
