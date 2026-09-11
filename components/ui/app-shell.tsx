import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { SyncvasLogo } from "@/components/ui/syncvas-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type AppShellProps = {
  children: ReactNode;
  title?: string;
  trailing?: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Full-bleed classroom chrome (no outer card). */
  classroom?: boolean;
  /** Classroom routes may own their own board-local chrome. */
  showClassroomHeader?: boolean;
};

export function AppShell({
  children,
  title,
  trailing,
  className,
  contentClassName,
  classroom = false,
  showClassroomHeader = true,
}: AppShellProps) {
  if (classroom) {
    return (
      <main className={cn("flex h-dvh flex-col bg-canvas text-ink", className)}>
        {showClassroomHeader ? (
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/"
                className="shrink-0 text-base font-semibold tracking-[-0.04em] text-ink"
                aria-label="Syncvas home"
              >
                <SyncvasLogo className="syncvas-app-logo" />
              </Link>
              {title ? (
                <>
                  <span aria-hidden="true" className="h-4 w-px bg-border" />
                  <h1 className="truncate text-sm font-medium text-ink-muted sm:text-base sm:text-ink">
                    {title}
                  </h1>
                </>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2"><ThemeToggle />{trailing}</div>
          </header>
        ) : null}
        <div className={cn("flex min-h-0 flex-1 flex-col", contentClassName)}>{children}</div>
      </main>
    );
  }

  return (
    <main className={cn("min-h-svh px-5 py-5 sm:px-8 sm:py-8 lg:px-12 lg:py-10", className)}>
      <div
        className={cn(
          "syncvas-panel mx-auto flex min-h-[calc(100svh-2.5rem)] max-w-6xl flex-col sm:min-h-[calc(100svh-4rem)]",
          contentClassName,
        )}
      >
        <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-5 sm:px-8">
          <Link
            className="text-lg font-bold tracking-[-0.04em]"
            href="/"
            aria-label="Syncvas home"
          >
            <SyncvasLogo className="syncvas-app-logo" />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {title ? <span className="syncvas-pill">{title}</span> : null}
            {trailing}
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}
