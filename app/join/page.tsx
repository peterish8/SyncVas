/**
 * Anonymous join by short code
 *
 * JoinCodeForm → Convex participants.joinByCode → redirect /student/[sessionId].
 * Never collect student name/email. Reject non-live sessions.
 */

import Link from "next/link";

import { JoinCodeForm } from "@/components/room/join-code-form";
import { AppShell } from "@/components/ui/app-shell";

export default function JoinPage() {
  return (
    <AppShell title="Join">
      <section className="grid flex-1 place-items-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="syncvas-color-field mb-6 overflow-hidden rounded-surface border border-white/50 p-1 shadow-soft">
            <div className="rounded-panel bg-surface/95 px-6 py-7 sm:px-8">
              <p className="text-sm font-medium text-ink-muted">Student entry</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Join class</h1>
              <p className="mt-3 text-sm leading-6 text-ink-muted">
                Enter the 6-character code from your teacher. No account needed.
              </p>
              <div className="mt-6">
                <JoinCodeForm />
              </div>
            </div>
          </div>
          <Link href="/" className="syncvas-btn syncvas-btn-ghost w-full text-sm">
            Back home
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
