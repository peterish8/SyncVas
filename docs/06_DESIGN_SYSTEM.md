# 06 — Design System

> Updated 2026-09-05 with the token consolidation. This file describes what is
> actually in the codebase; if it disagrees with the CSS, the CSS is wrong.

## Where the styles live

`app/globals.css` is a ~70-line composition root. It imports Tailwind, then four
layers, then maps tokens onto Tailwind utilities. Do not add rules to it.

| File | Holds | Rule |
|---|---|---|
| `app/styles/tokens.css` | primitives → semantic roles → dark theme | the only file with literal values |
| `app/styles/base.css` | element defaults, focus, reduced motion | no component rules |
| `app/styles/components.css` | `syncvas-*` product components | tokens only, no literals |
| `app/styles/landing.css` | `origin-*` marketing surface | tokens only, no literals |

**Adding a fifth parallel system is what produced the dead code removed in this
pass.** `landing-*` (61 selectors) and `landing-v2-*` (41 selectors, defined
three times) had zero usages in any `.tsx`. They are gone. Extend a layer.

## The three token layers

Declared in `app/styles/tokens.css`, in this order. Never skip a layer.

1. **Primitives** (`--sv-*`) — raw scale values: `--sv-neutral-200`,
   `--sv-radius-lg`, `--sv-space-4`, `--sv-text-base`, `--sv-elev-2`.
   **A component must never reference a primitive.**
2. **Semantic** — role names components use: `--surface`, `--ink-muted`,
   `--border`, `--accent`, `--radius-panel`, `--shadow-soft`, `--duration-press`.
   Each points at a primitive.
3. **Theme** — `html[data-theme="dark"]` restates *semantic* names only.

This is what makes a change propagate: editing `--sv-radius-lg` moves every
panel, board frame and dialog at once; editing `--accent` moves every accent
pill, focus ring, and dock trigger.

### Radius scale (the curved system)

| Token | Value | Semantic role | Used by |
|---|---|---|---|
| `--sv-radius-xs` | 6px | `--radius-icon` | icon buttons, small chips |
| `--sv-radius-sm` | 10px | `--radius-control` | buttons, inputs |
| `--sv-radius-md` | 14px | `--radius-card` | cards, list rows |
| `--sv-radius-lg` | 20px | `--radius-panel` | panels, **board frame** |
| `--sv-radius-xl` | 28px | `--radius-surface` | overlays, hero surfaces |
| `--sv-radius-2xl` | 36px | `--radius-feature` | full-bleed feature cards |
| `--sv-radius-pill` | 999px | `--radius-pill` | state chips, the room dock |

Exposed to Tailwind as `rounded-icon|control|card|panel|surface|feature`.
**There are no `rounded-[1.25rem]`-style arbitrary radii left in the app** — if
you need a new corner, add it to the scale.

### Spacing, type, control heights

- Spacing: `--sv-space-1..12` on a 4px base.
- Type: `--sv-text-2xs` (11px) → `--sv-text-3xl` (36px), plus tracking, weight
  and leading tokens.
- Control heights, three only: `--sv-control-sm` 32px, `--sv-control-md` 40px
  (default), `--sv-control-lg` 48px (touch/primary).

### Colour

Warm-neutral surfaces, accents as signals rather than surfaces. Semantic roles
are `--canvas --paper --surface --surface-muted --surface-sunken`,
`--ink --ink-muted --ink-subtle`, `--border --border-strong`, and
`--accent --info --warning --success --cool --danger` with `-soft` / `-border` /
`-ink` companions. Legacy names (`--lime`, `--coral`, `--green`, `--sky`,
`--apricot`) are kept as aliases so older markup keeps resolving.

`--field-gradient` is the one contained atmosphere recipe. It is permitted on
entry, marketing and summary surfaces only — **never behind handwriting**.

## Interaction physics

One recipe, in `--tactile-raised`. Variants set only the colour slots
(`--btn-bg`, `--btn-fg`, `--btn-border`, `--tactile-edge`, `--tactile-highlight`,
`--tactile-lowlight`, `--tactile-ambient`), so a change to the recipe changes
every button.

- **Raised** (buttons): hairline border, inset top highlight, solid 2px bottom
  edge, one ambient shadow. `:active` drops `--press-travel` (2px) and swaps to
  `--tactile-pressed`. Never `scale()` on hover.
- **Inset** (inputs): recessed shadow, no motion. Focus adds `--focus-ring`
  (lime) and an accent border.
- Button variants: `primary` (ink), `secondary` (neutral), `accent` (lime-soft),
  `success`, `danger`, `danger-quiet`, `ghost`. Sizes: `syncvas-btn-sm|lg`.
  `danger-quiet` is the destructive-but-not-dominant treatment used for **End
  room**: red text and a red-tinted hairline on a normal surface, filling to
  `--danger-soft` only on hover.

### Motion

`--duration-press` 110ms, `--duration-hover` 140ms, `--duration-panel` 220ms,
`--duration-modal` 200ms; `--ease-press` for presses, `--ease-out` to settle.
Nothing pulses and nothing loops inside a live class. Under
`prefers-reduced-motion` all transitions collapse and press transforms are
disabled (`app/styles/base.css`).

## Component inventory (`app/styles/components.css`)

Surfaces `syncvas-panel` `syncvas-card` `syncvas-sunken` `syncvas-color-field`
`syncvas-divider` · Inputs `syncvas-control` `syncvas-label` `syncvas-hint`
`syncvas-eyebrow` · Buttons `syncvas-btn` + variants · `syncvas-icon-btn`
`syncvas-theme-toggle` · Chips `syncvas-pill` (`-accent` `-warning` `-danger`)
`syncvas-live-dot` `syncvas-code` · Board `syncvas-board-frame`
`syncvas-board-chrome` `syncvas-board-alert` · Room chrome `syncvas-room-panel`
`syncvas-dock-collapsed` (icon-first live-room disclosure) · legacy
`syncvas-dock` `syncvas-dock-trigger` styles remain available to existing
surfaces · Overlays `syncvas-overlay`
`syncvas-modal` `syncvas-modal-close` `syncvas-qr-stage` `syncvas-qr-frame`
`syncvas-qr-code` `syncvas-qr-url` · `syncvas-sr-only`

## Teacher layout: setup collapses, board takes over

`components/room/teacher-session-controls.tsx` renders one state machine in two
presentations:

- **Not live** — a single composed setup surface: eyebrow, title, supporting
  copy, identity pill, a gradient hairline, then the title field + create action,
  then the room card (code, status, participants, Start room).
- **Live or ending** — the setup surface is replaced by `RoomDock`, absolutely
  positioned at the bottom-centre of the board column in
  `app/teacher/page.tsx`. The collapsed state is a single labelled icon with a
  live indicator so it cannot cover the drawing area or native Excalidraw
  controls. Clicking it reveals the full control set (code, status,
  participants, QR, export, End room) in `syncvas-room-panel`. Escape and the
  collapse button close the panel and restore focus to the icon.

The board column is `relative` so the dock overlays the board without shrinking
it; the board therefore occupies effectively the whole viewport once live.

## QR behaviour

`components/room/join-qr.tsx` exports:

- `JoinQrButton` — the compact dock trigger plus the overlay. This is what live
  rooms use. The QR never occupies the setup layout.
- `JoinQr` — the inline card, kept for surfaces that legitimately show a QR in
  flow.

The overlay renders through `components/ui/modal.tsx`: portal to `document.body`
(so the board's `overflow:hidden` cannot clip it), Escape to close, focus trap,
focus restored on close, backdrop click to dismiss, body scroll locked,
`role="dialog"` + `aria-modal`. The QR is generated at 720px and displayed at
`clamp(12rem, 34vmin, 22rem)` so it scans from across a room; the code renders at
`clamp(28px, 7vmin, 4rem)`. **Present fullscreen** puts the stage into the
Fullscreen API, where the QR grows to `clamp(16rem, 52vmin, 42rem)`.

## Board frame and fullscreen

`syncvas-board-frame` gives the canvas the same 20px curve as every other panel,
and drops its radius and border while `:fullscreen`. `components/board/
board-canvas.tsx` owns a fullscreen toggle that targets the frame, so Excalidraw
keeps its own sizing and the room chrome outside the frame simply stops painting.

The shell theme toggle is also the board theme toggle. `BoardCanvas` listens for
`THEME_CHANGE_EVENT`, passes `light`/`dark` to Excalidraw, and updates
`--board-paper`; the setting remains local to each viewer and is never included
in the shared board scene.

**Overlay zoning.** Excalidraw owns its top-left menu, top-centre toolbar,
top-right library, and both bottom corners. Syncvas board chrome lives in one
top-left lane beginning below that native control band (canvas label + fullscreen
button, then connection/follow pills). Degraded room-token errors use a
dedicated bottom-right `syncvas-board-alert` lane above Excalidraw's help control.
The chrome wrapper does not intercept stylus gestures; only the explicit
fullscreen button is interactive. Below `sm`
that lane is hidden entirely — Excalidraw's mobile toolbar owns the frame top,
and the room dock carries live state.

## Accessibility and responsive decisions

- Focus is visible everywhere: `--focus-outline` (lime) on controls,
  `--focus-ring` on inputs, and a 2px ink outline as the global default.
- The dock disclosure uses `aria-expanded` / `aria-controls`; the QR trigger uses
  `aria-haspopup="dialog"` and carries an `aria-label` because its text label
  collapses to an icon below `sm`.
- Follow state stays textual ("Following" / "Free roam"), never colour alone.
- The dock wraps rather than overflowing on narrow screens.
- Participant count is `aria-live="polite"`.

## Copy style

Direct verbs: Start room · Join class · Follow teacher · Return to teacher ·
Ask doubt · Mark answered · End room.
