# Visual Direction — Soft Clinical Calm + Tactile Controls

## Reference interpretation

The supplied tablet reference establishes atmosphere only, not Syncvas information architecture. Its useful qualities are a quiet warm-grey field, high-key solid surfaces, generous rounded geometry, fine low-contrast dividers, precise near-black typography, and a handful of softly blended luminous accents.

Syncvas remains a canvas-first classroom tool. Do not borrow dashboard metrics, health cards, commerce modules, dense permanent sidebars, or any layout that competes with handwriting.

## Palette (Syncvas tokens)

| Token | Value | Use |
|---|---|---|
| `canvas` | `#F7F6F3` | Warm paper-like application background and board surround |
| `surface` | `#FFFFFF` | Solid controls, dialogs, sheets, and cards |
| `surface-muted` | `#EEEDE9` | Secondary zones and selected surfaces |
| `ink` | `#171717` | High-legibility primary type and primary raised CTAs |
| `ink-muted` | `#66645F` | Supporting copy only |
| `border` | `#DDDCD7` | Fine 1px separators |
| `lime` | `#D7F500` | Sparse accent / focus ring / accent-button tint |
| `coral` | `#F47B68` | Warm informational accent, never danger-only meaning |
| `apricot` | `#F6C96D` | Soft blended accent edge |
| `green` | `#39A954` | Success support with text/icon label |
| `sky` | `#B9D9F5` | Cool blended accent edge |
| `danger` | `#B42318` | Destructive actions only (End class) |

Palette stays warm-neutral. Interaction language is separate (see below).

## Tactile interaction language (physics)

Adopted from the Tactile UI System. Physics is non-negotiable; palette stays Syncvas.

**Raised controls (buttons):**
- 1px border
- Inset top highlight (`inset 0 1px 0` lighter-than-surface)
- Solid 1–2px bottom edge in a darker shade (this sells “raised,” not blur alone)
- One small exterior ambient shadow
- On `:active`: `translateY(2px)` and lose the bottom-edge shadow
- No `scale()` on hover

**Inset controls (inputs, doubt composer):**
- Recessed via inset shadow
- Focus adds a lime-tinted ring, not press motion

**Timing:**
| Interaction | Duration |
|---|---:|
| Button press | 100–120ms |
| Hover | 130–160ms |
| Dropdown | 160–190ms |
| Side panel / sheet | 220–260ms |
| Modal | 200–240ms |

Easing: `--ease-press: cubic-bezier(0.2, 0, 0, 1)` for press; `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)` for settle.

**Button variants in CSS:** `.syncvas-btn-primary` (ink), `-secondary`, `-accent` (lime tint), `-success`, `-danger`, `-ghost`.

## Component treatment

- Solid off-white surfaces, 1px borders, ~20–28px radii for panels, ~10px for controls; pills only for short state chips.
- Contained color fields may blend two or three accents at low intensity inside join/status/summary surfaces only — never over Excalidraw.
- Classroom canvas stays neutral and high contrast. Teacher stylus controls stay discoverable and low-friction.
- State uses explicit copy and icons in addition to color. Honor visible focus, ~44px student targets, and reduced motion (press transforms disabled).

## Phase application

- Phase 2 board: neutral canvas, compact solid room chrome with tactile chrome controls, no decorative color layer over Excalidraw.
- Phase 3 room/join: restrained color field may frame join confirmation or live room state; code/QR stays high contrast; join CTA uses raised primary physics.
- Phase 4 follow: floating controls are calm solid raised pills/buttons; "Following" and "Return to Teacher" are textually explicit.
- Phase 5 doubts: right-sheet / bottom-sheet stays solid; composer uses inset input physics; outcomes use copy plus accessible status treatment.
- Phases 6–10: finalization, export, history, moderation, and integration states reuse the same raised/inset hierarchy — no dashboard tiles.

## Explicit exclusions

- No glassmorphism, page-wide gradients, neon blobs, large glows, hover scaling, or opaque headers over the board.
- No continuous pulsing on live/AI indicators.
- No status-only color meanings; no color-field content with inadequate contrast.
- No health/product analytics layout copied from the tablet reference.
