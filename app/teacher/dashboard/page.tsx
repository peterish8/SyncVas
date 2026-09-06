"use client";

import Link from "next/link";
import { useQuery } from "convex/react";

import { AppShell } from "@/components/ui/app-shell";
import { api } from "@/convex/_generated/api";

function formatDate(timestamp: number | undefined): string {
  if (!timestamp) return "Not started";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(timestamp);
}

function formatDuration(startedAt: number | undefined, endedAt: number | undefined): string {
  if (!startedAt) return "Draft class";
  const end = endedAt ?? Date.now();
  const minutes = Math.max(1, Math.round((end - startedAt) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
}

function statusLabel(status: string): string {
  if (status === "live") return "Live now";
  if (status === "ended") return "Completed";
  if (status === "ending") return "Finishing";
  return "Draft";
}

export default function TeacherDashboardPage() {
  const localTeacherEnabled =
    process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ENABLE_LOCAL_TEACHER === "1";
  const dashboard = useQuery(
    localTeacherEnabled ? api.sessions.getLocalTeacherDashboard : api.sessions.getTeacherDashboard,
    {},
  );
  const sessions = dashboard?.sessions ?? [];
  const totals = dashboard?.totals ?? {
    classCount: 0,
    liveCount: 0,
    endedCount: 0,
    studentJoins: 0,
    savedBoardCount: 0,
  };
  const latestSession = sessions[0];
  const activeSession = sessions.find((session) => session.status === "live") ?? latestSession;

  return (
    <AppShell
      trailing={
        <div className="flex items-center gap-2">
          <Link href="/teacher" className="syncvas-btn syncvas-btn-accent syncvas-btn-sm">
            New class
          </Link>
          <Link href="/teacher/history" className="syncvas-btn syncvas-btn-ghost syncvas-btn-sm">
            History
          </Link>
        </div>
      }
      className="syncvas-dashboard-shell"
    >
      <div className="syncvas-dashboard-page">
        <div className="syncvas-dashboard-layout">
          <aside className="syncvas-dashboard-nav" aria-label="Teacher workspace">
            <div>
              <p className="syncvas-eyebrow">Workspace</p>
              <h1 className="mt-2 text-xl font-semibold tracking-[-0.04em]">Your classroom studio</h1>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                Keep every live room, finished canvas, and student signal in one calm place.
              </p>
            </div>
            <nav className="mt-8 grid gap-1" aria-label="Dashboard sections">
              <Link href="/teacher/dashboard" className="syncvas-dashboard-nav-link syncvas-dashboard-nav-link-active">
                <span className="syncvas-dashboard-nav-icon" aria-hidden="true">01</span>
                Overview
              </Link>
              <Link href="/teacher" className="syncvas-dashboard-nav-link">
                <span className="syncvas-dashboard-nav-icon" aria-hidden="true">＋</span>
                Live classroom
              </Link>
              <Link href="/teacher/history" className="syncvas-dashboard-nav-link">
                <span className="syncvas-dashboard-nav-icon" aria-hidden="true">02</span>
                Canvas history
              </Link>
            </nav>
            <div className="syncvas-dashboard-nav-note mt-8">
              <span className="syncvas-live-dot" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold text-ink">Private by design</p>
                <p className="mt-1 text-xs leading-5 text-ink-muted">Student counts are anonymous room totals.</p>
              </div>
            </div>
          </aside>

          <main className="syncvas-dashboard-main">
            <header className="syncvas-dashboard-heading">
              <div>
                <p className="syncvas-eyebrow">Teacher overview</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">Good teaching starts here.</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-ink-muted">
                  A quick read on your rooms, canvases, and the students who joined them.
                </p>
              </div>
              <div className="syncvas-dashboard-date">Updated live</div>
            </header>

            <section className="syncvas-dashboard-metrics" aria-label="Classroom totals">
              <article className="syncvas-dashboard-metric syncvas-dashboard-metric-lime">
                <span className="syncvas-dashboard-metric-label">All classes</span>
                <strong>{totals.classCount}</strong>
                <span>rooms created</span>
              </article>
              <article className="syncvas-dashboard-metric syncvas-dashboard-metric-coral">
                <span className="syncvas-dashboard-metric-label">Student joins</span>
                <strong>{totals.studentJoins}</strong>
                <span>anonymous room entries</span>
              </article>
              <article className="syncvas-dashboard-metric syncvas-dashboard-metric-green">
                <span className="syncvas-dashboard-metric-label">Live now</span>
                <strong>{totals.liveCount}</strong>
                <span>{totals.endedCount} completed classes</span>
              </article>
              <article className="syncvas-dashboard-metric syncvas-dashboard-metric-apricot">
                <span className="syncvas-dashboard-metric-label">Saved canvases</span>
                <strong>{totals.savedBoardCount}</strong>
                <span>finished boards</span>
              </article>
            </section>

            <section className="syncvas-dashboard-feature" aria-labelledby="dashboard-feature-title">
              <div>
                <p className="syncvas-eyebrow">Canvas spotlight</p>
                <h3 id="dashboard-feature-title" className="mt-2 text-2xl font-semibold tracking-[-0.045em]">
                  {activeSession ? activeSession.title : "Your next canvas is ready"}
                </h3>
                <p className="mt-2 max-w-lg text-sm leading-6 text-ink-muted">
                  {activeSession
                    ? `${statusLabel(activeSession.status)} · ${activeSession.studentCount} students joined · ${formatDuration(activeSession.startedAt, activeSession.endedAt)}`
                    : "Open a live classroom to start drawing, share a QR code, and collect a clean board artifact."}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {activeSession?.subject ? <span className="syncvas-pill">{activeSession.subject}</span> : null}
                  {activeSession ? <span className="syncvas-pill">Board v{activeSession.latestBoardVersion}</span> : null}
                  {activeSession?.hasSavedBoard ? <span className="syncvas-pill syncvas-pill-accent">Saved canvas</span> : null}
                </div>
              </div>
              <div className="syncvas-dashboard-feature-art" aria-hidden="true">
                <span className="syncvas-dashboard-feature-orb syncvas-dashboard-feature-orb-lime" />
                <span className="syncvas-dashboard-feature-orb syncvas-dashboard-feature-orb-green" />
                <span className="syncvas-dashboard-feature-orb syncvas-dashboard-feature-orb-coral" />
                <span className="syncvas-dashboard-feature-grid" />
              </div>
              <Link href={activeSession?.status === "live" ? "/teacher" : "/teacher/history"} className="syncvas-btn syncvas-btn-primary mt-6 sm:mt-0">
                {activeSession?.status === "live" ? "Open live class" : "View canvas history"}
              </Link>
            </section>

            <section className="syncvas-dashboard-card" aria-labelledby="dashboard-sessions-title">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="syncvas-eyebrow">Your canvases</p>
                  <h3 id="dashboard-sessions-title" className="mt-2 text-xl font-semibold tracking-[-0.04em]">Recent classes</h3>
                </div>
                <Link href="/teacher/history" className="text-sm font-semibold text-ink underline-offset-4 hover:underline">See all history</Link>
              </div>

              {dashboard === undefined ? (
                <div className="syncvas-dashboard-loading mt-5" aria-label="Loading classes">
                  <span /><span /><span />
                </div>
              ) : sessions.length === 0 ? (
                <div className="syncvas-dashboard-empty mt-5">
                  <span className="syncvas-auth-mark syncvas-auth-mark-accent" aria-hidden="true">S</span>
                  <div>
                    <p className="font-semibold">No canvases yet</p>
                    <p className="mt-1 text-sm leading-6 text-ink-muted">Create your first room and your canvas stats will appear here.</p>
                  </div>
                  <Link href="/teacher" className="syncvas-btn syncvas-btn-accent mt-3 sm:ml-auto sm:mt-0">Start a class</Link>
                </div>
              ) : (
                <ul className="syncvas-dashboard-session-list mt-5">
                  {sessions.slice(0, 8).map((session) => (
                    <li key={session.sessionId} className="syncvas-dashboard-session-row">
                      <div className="syncvas-dashboard-session-title">
                        <span className={`syncvas-dashboard-status syncvas-dashboard-status-${session.status}`}>
                          {statusLabel(session.status)}
                        </span>
                        <p className="mt-2 font-semibold tracking-[-0.02em]">{session.title}</p>
                        <p className="mt-1 text-xs text-ink-muted">{session.subject ?? "General classroom"} · {formatDate(session.startedAt)}</p>
                      </div>
                      <div className="syncvas-dashboard-session-stat"><strong>{session.studentCount}</strong><span>students</span></div>
                      <div className="syncvas-dashboard-session-stat"><strong>{session.latestBoardVersion}</strong><span>board version</span></div>
                      <div className="syncvas-dashboard-session-stat"><strong>{formatDuration(session.startedAt, session.endedAt)}</strong><span>class length</span></div>
                      <span className="syncvas-dashboard-session-arrow" aria-hidden="true">↗</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </main>
        </div>
      </div>
    </AppShell>
  );
}
