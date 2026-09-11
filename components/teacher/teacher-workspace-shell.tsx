"use client";

/**
 * The teacher workspace chrome: header, full-height nav rail, content column.
 *
 * Every signed-in teacher surface outside the live classroom renders through this,
 * so the rail is the same object on the dashboard as it is on history. The live
 * class board deliberately does not use it — that surface is canvas-first and runs
 * `AppShell classroom` instead.
 *
 * Below the desktop breakpoint the rail is replaced by an off-canvas drawer built
 * on a native `<dialog>` opened with `showModal()`. That is the platform's own
 * modal: the dialog moves to the top layer, everything else in the document
 * becomes inert, Escape closes it, and focus is contained — none of which a
 * hand-rolled focus trap gets right for free. `closedby="any"` adds click-outside
 * light dismiss where supported, with a backdrop-click fallback below for browsers
 * that do not implement it yet.
 */

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { TeacherWorkspaceNav } from "@/components/teacher/teacher-workspace-nav";
import { AppShell } from "@/components/ui/app-shell";
import { cn } from "@/lib/utils";

type TeacherWorkspaceShellProps = {
  children: ReactNode;
  /** Header actions, right of the theme toggle. */
  trailing?: ReactNode;
  title?: string;
  /** Extra classes for the content column. */
  mainClassName?: string;
};

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function TeacherWorkspaceShell({
  children,
  trailing,
  title,
  mainClassName,
}: TeacherWorkspaceShellProps) {
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  // Identity-stable so the nav's effect does not re-run every render.
  const handleNavCollapsedChange = useCallback((collapsed: boolean) => {
    setNavCollapsed(collapsed);
  }, []);

  const openDrawer = useCallback(() => {
    // showModal() rather than show(): only the modal form puts the dialog in the
    // top layer and makes the rest of the page inert.
    drawerRef.current?.showModal();
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    drawerRef.current?.close();
  }, []);

  // `closedby` is newer than the typings, so it is set on the node rather than
  // as a JSX prop. Browsers without it fall back to the backdrop click below.
  useEffect(() => {
    drawerRef.current?.setAttribute("closedby", "any");
  }, []);

  // Following a link inside the drawer must not leave it open over the new page.
  useEffect(() => {
    if (drawerRef.current?.open) drawerRef.current.close();
  }, [pathname]);

  return (
    <AppShell
      title={title}
      trailing={trailing}
      className={cn("syncvas-dashboard-shell", navCollapsed && "syncvas-dashboard-shell-collapsed")}
    >
      <button
        type="button"
        className="syncvas-nav-drawer-trigger"
        aria-expanded={drawerOpen}
        aria-haspopup="dialog"
        onClick={openDrawer}
      >
        <MenuIcon />
        <span className="sr-only">Open navigation</span>
      </button>

      <dialog
        ref={drawerRef}
        className="syncvas-nav-drawer"
        aria-label="Teacher workspace navigation"
        onClose={() => setDrawerOpen(false)}
        onClick={(event) => {
          // The dialog box itself only receives the click when the pointer landed
          // on the backdrop, so this is the light-dismiss fallback.
          if (event.target === drawerRef.current) closeDrawer();
        }}
      >
        <TeacherWorkspaceNav variant="drawer" />
      </dialog>

      <div className="syncvas-dashboard-page">
        <div
          className={cn(
            "syncvas-dashboard-layout",
            navCollapsed && "syncvas-dashboard-layout-collapsed",
          )}
        >
          <TeacherWorkspaceNav onCollapsedChange={handleNavCollapsedChange} />
          <main className={cn("syncvas-dashboard-main", mainClassName)}>{children}</main>
        </div>
      </div>
    </AppShell>
  );
}
