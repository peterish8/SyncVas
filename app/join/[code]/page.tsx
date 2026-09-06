/**
 * QR / deep-link join
 *
 * Same join path as short code — resolve code → live session → student route.
 */

import Link from "next/link";

import { JoinCodeForm } from "@/components/room/join-code-form";
import { AppShell } from "@/components/ui/app-shell";

type Props = { params: Promise<{ code: string }> };

export default async function JoinByCodePage({ params }: Props) {
  const { code } = await params;
  return (
    <AppShell title="Join">
      <section className="grid flex-1 place-items-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="syncvas-color-field mb-6 overflow-hidden rounded-surface border border-white/50 p-1 shadow-soft">
            <div className="rounded-panel bg-surface/95 px-6 py-7 sm:px-8">
              <p className="text-sm font-medium text-ink-muted">Student entry</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Join class</h1>
              <p className="mt-3 text-sm leading-6 text-ink-muted">
                Confirm the code from your QR link, then join. No account needed.
              </p>
              <div className="mt-6">
                <JoinCodeForm initialCode={code} />
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
