# 05 — UI/UX Specification

## Design intent

The classroom page is a tool, not a dashboard. The canvas must dominate. Controls should feel calm, compact, tactile, and disappear when not needed.

## Visual character

Take inspiration from the supplied tablet reference without copying its health-product information architecture: warm pale-neutral space, solid rounded surfaces, fine low-contrast borders, near-black typography, and a small number of softly blended color-field accents. The feeling should be optimistic and tactile, as if the interface is a quiet physical teaching tool.

Controls follow the Tactile UI System physics on Syncvas palette tokens: buttons read as raised (inset top highlight + solid bottom edge + short ambient shadow) and press down 2px while losing that bottom edge; inputs read as inset and focus with a lime-tinted ring. Timing stays fast (press ~110ms). No glassmorphism, large glows, or hover scaling.

Keep this visual treatment subordinate to the classroom task. The teacher board remains a high-contrast, mostly neutral working surface; student controls remain extremely legible. Do not turn the classroom into a metrics dashboard, fill the canvas with cards, or use decorative effects that compete with handwriting.

## Teacher classroom layout

Desktop-first because teacher uses XP-Pen/tablet display.

Top bar:
- app mark/name
- class title
- LIVE status
- connected student count
- room code / QR trigger
- doubt badge
- End Class

Canvas:
- full remaining viewport
- Excalidraw controls kept minimal
- no product overlays intercepting stylus gestures except explicit buttons
- neutral, paper-like surrounding chrome; no color field sits over the drawable board
- reserve Excalidraw's native top-left, top-centre, top-right, and bottom control
  zones; Syncvas connection/version chrome sits in a compact lane below the native
  toolbar and remains transparent to canvas gestures
- the global Light/Dark control applies to the Excalidraw board as well as the
  surrounding classroom chrome; the board paper and native tool rail update together
- once a room is live, show one small room icon at bottom-centre; clicking it
  expands the code, live state, participant count, QR, export, and End room actions
  into a rounded panel. Escape and the collapse control return to the icon.

Doubt drawer:
- right-side sheet, not permanent sidebar
- ranked cards
- same-doubt count prominent
- `Answered`, `Dismiss` actions
- never reveal student identity

## Student classroom layout

Canvas uses nearly full viewport.

Floating bottom control strip:
- `Follow Teacher` or `Following`
- `Ask Doubt`
- optional `Same doubt` entry via queue later

When free-roaming after follow:
- compact pill: `You’re exploring • Return to Teacher`

Connectivity:
- tiny status chip only when degraded/reconnecting

## Join screen

One task only:
- code input (6 chars)
- Join
- QR path bypasses typing

Do not ask student name in MVP.

## Doubt composer

Bottom sheet/modal:
- textarea
- max 220 characters initially
- anonymous explanation
- submit
- inline moderation feedback

Avoid red for normal rejected relevance; reserve strong red for actual errors/abuse lockout. Use neutral/amber explanation for “not related to current lecture”.

## Accessibility

- keyboard reachable buttons
- visible focus states
- minimum target size ~44px for student mobile controls
- icon-only buttons require accessible labels
- do not communicate connection/follow state by color alone
- reduced motion respected
- color-field surfaces must keep their labels and controls at WCAG-appropriate contrast; color never carries status on its own

## Mobile

Student mode must work well on phones. Teacher editing on mobile is not a P0 target.
