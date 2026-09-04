import Link from "next/link";

import { ConvexHealthStatus } from "@/components/foundation/convex-health-status";
import { SocketHealthStatus } from "@/components/foundation/socket-health-status";

const isConvexConfigured = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

function StatusDot({ tone }: { tone: "ready" | "waiting" }) {
  return (
    <span
      aria-hidden="true"
      className={
        tone === "ready"
          ? "mt-1.5 size-2.5 shrink-0 rounded-full bg-[#39A954]"
          : "mt-1.5 size-2.5 shrink-0 rounded-full bg-[#D7F500] ring-1 ring-black/15"
      }
    />
  );
}

export default function Home() {
  return (
    <main className="min-h-svh px-5 py-5 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
      <div className="mx-auto flex min-h-[calc(100svh-2.5rem)] max-w-6xl flex-col rounded-[2rem] border border-border bg-surface shadow-[0_10px_28px_rgb(23_23_23/0.06)] sm:min-h-[calc(100svh-4rem)]">
        <header className="flex items-center justify-between border-b border-border px-6 py-5 sm:px-8">
          <Link className="text-lg font-bold tracking-[-0.04em]" href="/" aria-label="Syncvas home">
            Syncvas
          </Link>
          <span className="rounded-full border border-border bg-canvas px-3 py-1 text-xs font-medium text-ink-muted">
            Foundation
          </span>
        </header>

        <section className="grid flex-1 gap-10 px-6 py-14 sm:px-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:px-14 lg:py-16" aria-labelledby="foundation-title">
          <div className="max-w-xl">
            <p className="mb-4 text-sm font-medium text-ink-muted">The classroom canvas</p>
            <h1 id="foundation-title" className="max-w-lg text-balance text-4xl font-semibold tracking-[-0.06em] sm:text-5xl lg:text-6xl">
              Ready for the first lesson.
            </h1>
            <p className="mt-6 max-w-md text-pretty text-base leading-7 text-ink-muted sm:text-lg">
              The product foundation is in place for a teacher-led live board: a deliberate frontend shell, a durable Convex boundary, and a separate realtime service.
            </p>
            <p className="mt-8 rounded-2xl border border-border bg-canvas px-4 py-3 font-mono text-sm text-ink">
              npm run dev:all
            </p>
          </div>

          <div className="syncvas-color-field relative overflow-hidden rounded-[1.75rem] border border-white/60 p-5 shadow-[0_16px_32px_rgb(23_23_23/0.12)] sm:p-6">
            <div className="rounded-[1.35rem] border border-white/75 bg-white p-5 shadow-[0_8px_20px_rgb(23_23_23/0.08)]">
              <div className="flex items-start gap-3">
                <StatusDot tone="ready" />
                <div>
                  <p className="font-medium">Frontend</p>
                  <p className="mt-1 text-sm leading-6 text-ink-muted">Next.js App Router, strict TypeScript, responsive layout, and accessible focus treatment.</p>
                </div>
              </div>
              <div className="my-5 h-px bg-border" />
              <ConvexHealthStatus configured={isConvexConfigured} />
              <div className="my-5 h-px bg-border" />
              <SocketHealthStatus />
            </div>
            <p className="relative mt-4 text-sm font-medium text-[#252525]">
              Calm tools. One authoritative teacher canvas. No student editing.
            </p>
          </div>
        </section>

        <footer className="border-t border-border px-6 py-4 text-sm text-ink-muted sm:px-8">
          Milestone 0 · project foundation only
        </footer>
      </div>
    </main>
  );
}
