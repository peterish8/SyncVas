# 12 — Excalidraw Integration Specification

## Package

Use `@excalidraw/excalidraw`, licensed under MIT. Keep required third-party notices in an Open Source Licenses/About surface and distribution notices.

## Next.js rule

Excalidraw is browser-dependent. Integrate it as a client component and, if needed by the installed package/runtime, dynamically import with SSR disabled. Ensure the parent container has a real height; a zero-height parent produces an apparently blank editor.

## Teacher mode

Render normal editor capabilities required for class:
- free draw
- eraser
- shapes/arrows/text
- undo/redo
- pan/zoom

Do not fork Excalidraw initially.

Capture scene changes using supported package API (`onChange`/API exposed by installed version). Debounce/throttle serialization/broadcast intelligently so handwriting remains local-first and responsive.

## Student mode

Use Excalidraw in viewer/read-only style controlled by our wrapper:
- no editor toolbar for mutating tools
- no client path sends `board:update`
- server also rejects board update attempts from student role
- pan/zoom remain available

Client-side hiding is UX; server role enforcement is security.

## Applying remote scene

Keep a stable `excalidrawAPI` reference. Apply server-provided canonical scene using the current installed package's supported scene-update API. Before coding, inspect the installed version docs/types rather than assuming an outdated method signature.

## Avoid feedback loops

Remote application of a scene may trigger change callbacks. Maintain a guard/source flag so applying server state does not immediately rebroadcast the same state as a new teacher edit.

## Assets/files

If teacher inserts images later, Excalidraw file/blob handling must be synchronized separately from element JSON. P0 can disable image insertion if asset syncing is not implemented.

## Stylus verification checklist

Test on actual XP-Pen hardware:
- freehand starts/stops correctly
- pressure behavior acceptable
- eraser tool usable
- palm/touch does not create accidental strokes if device emits touch
- stroke remains responsive while 50+ socket messages are flowing
- browser zoom gestures do not conflict with canvas zoom

## Branding

Do not display Excalidraw branding in normal classroom UI. Preserve license notice in `Open Source Licenses` and distributed license notices as required by MIT.

The product chrome around the canvas follows the Syncvas design system: warm-neutral, solid controls and restrained rounded surfaces. Never place decorative color fields over the drawable Excalidraw region or make stylus controls low contrast for visual effect.
