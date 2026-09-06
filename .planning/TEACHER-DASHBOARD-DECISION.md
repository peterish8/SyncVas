# Teacher dashboard decision

Date: 2026-09-06

## Decision

Add a teacher-only overview at `/teacher/dashboard` backed by a single Convex aggregate query. The page shows classes, live rooms, student joins, saved canvases, the most recent canvas spotlight, and recent per-session stats.

## Why

Teachers need a fast way to understand what they have taught and which canvases are available after class. The existing History page is a useful archive but does not provide an operational overview or per-session participation summary.

## Data boundary

`convex/sessions.ts` derives the dashboard from the teacher's indexed sessions and each session's indexed participant rows. Counts are anonymous and room-scoped. No names, raw doubt text, or speculative engagement scores are added.

## Design boundary

The dashboard follows the supplied reference direction: light mode is gray and white with black type and small soft color accents; dark mode is near-black with the same semantic accents. The atmosphere remains inside the dashboard spotlight card and does not enter the whiteboard surface.
