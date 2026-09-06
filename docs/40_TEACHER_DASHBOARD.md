# Teacher Dashboard

## Purpose

The teacher dashboard is the entry point for reviewing live rooms and finished canvases. It keeps the same warm-neutral visual system as the classroom UI while borrowing the reference dashboard's quiet white surfaces, rounded cards, small accent borders, and restrained color fields.

## Route and navigation

- `/teacher/dashboard` is the overview route.
- The teacher board links to Dashboard, Live classroom, and History.
- History remains the detailed finished-class list; the dashboard is the quick operational overview.

## Authoritative metrics

The dashboard reads `sessions` and room-scoped `participants` through `sessions:getTeacherDashboard` (or the gated local-teacher equivalent). It reports:

- all sessions owned by the teacher
- live and ended session counts
- unique pseudonymous participant rows per session
- sessions with a final board snapshot
- board version, class duration, subject, and lifecycle status per canvas

Student identities, raw doubt text, and invasive engagement analytics are intentionally excluded. A participant count is a count of anonymous room entries for that session.

## Visual contract

- Light theme uses a neutral gray dashboard canvas, white surfaces, black type, soft borders, and lime/coral/green/apricot accents as small signals.
- Dark theme uses a near-black dashboard canvas and near-black cards; accents remain restrained so text and classroom controls stay readable.
- The contained color field is limited to the canvas spotlight card. It never covers the drawable Excalidraw region.
- All radii, spacing, color roles, and shadows resolve through `app/styles/tokens.css` and `app/styles/components.css`.
