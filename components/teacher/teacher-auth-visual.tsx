import { SyncvasLogo } from "@/components/ui/syncvas-logo";

/**
 * The sign-in side panel: the Syncvas ribbon artwork, and nothing on top of it
 * but the scrim the quote needs to stay readable.
 *
 * The artwork has a dark and a light cut, swapped in CSS on `html[data-theme]`
 * rather than with two <Image> elements: the cascade resolves to a single
 * `background-image`, so the browser fetches one file instead of both and the
 * panel never flashes the wrong cut. That is why the asset paths live in
 * `app/styles/components.css` and not here.
 */
export function TeacherAuthVisual() {
  return (
    <aside className="syncvas-auth-visual" aria-hidden="true">
      <div className="syncvas-auth-visual-media">
        <div className="syncvas-auth-visual-scrim" />
      </div>

      <div className="syncvas-auth-visual-copy">
        <div className="syncvas-auth-visual-brand">
          <SyncvasLogo />
        </div>
        <blockquote className="syncvas-auth-quote">
          <p>
            One pen. Every mind. Open a room, write live, and leave the board where the lesson can
            still be found.
          </p>
          <footer>Syncvas classroom</footer>
        </blockquote>
      </div>
    </aside>
  );
}
