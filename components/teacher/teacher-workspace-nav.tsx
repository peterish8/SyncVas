"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { useCallback, useEffect, useMemo } from "react";

import { api } from "@/convex/_generated/api";
import { SyncvasMark } from "@/components/ui/syncvas-logo";
import { notifyStoredValue, useStoredValue } from "@/lib/client-store";
import { cn } from "@/lib/utils";

const NAV_COLLAPSE_KEY = "syncvas.teacherNavCollapsed";

/** Module scope: `useStoredValue` needs a stable snapshot parser. */
function parseNavCollapsed(raw: string | null): boolean {
  return raw === "1";
}

type NavItem = {
  href: string;
  label: string;
  icon: string;
  match?: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/teacher/dashboard",
    label: "Overview",
    icon: "01",
    match: (pathname) => pathname.startsWith("/teacher/dashboard"),
  },
  {
    href: "/teacher",
    label: "Live classroom",
    icon: "＋",
    match: (pathname) => pathname === "/teacher" || pathname.startsWith("/teacher/session"),
  },
  {
    href: "/teacher/history",
    label: "Canvas history",
    icon: "02",
    match: (pathname) => pathname.startsWith("/teacher/history"),
  },
];

/** ChatGPT-style sidebar glyph: a panel with its rail divided off. */
function PanelIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M9.5 4v16" />
    </svg>
  );
}

function initialsFrom(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name?.trim() || email?.trim() || "T").replace(/\s+/g, " ");
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

type TeacherWorkspaceNavProps = {
  onCollapsedChange?: (collapsed: boolean) => void;
  /**
   * "rail" is the pinned desktop sidebar. "drawer" is the same nav inside the
   * mobile dialog, where collapsing makes no sense — the drawer is dismissed,
   * not narrowed.
   */
  variant?: "rail" | "drawer";
};

export function TeacherWorkspaceNav({ onCollapsedChange, variant = "rail" }: TeacherWorkspaceNavProps) {
  const pathname = usePathname();
  const viewer = useQuery(api.users.getViewer);
  const { signOut } = useAuthActions();
  const isDrawer = variant === "drawer";
  // localStorage is an external system: subscribed, not copied into state
  // inside an effect (react-hooks/set-state-in-effect).
  const storedCollapsed = useStoredValue({
    storage: "local",
    key: NAV_COLLAPSE_KEY,
    parse: parseNavCollapsed,
    serverValue: false,
  });
  const collapsed = isDrawer ? false : storedCollapsed;

  useEffect(() => {
    onCollapsedChange?.(collapsed);
  }, [collapsed, onCollapsedChange]);

  const toggleCollapsed = useCallback(() => {
    try {
      window.localStorage.setItem(NAV_COLLAPSE_KEY, storedCollapsed ? "0" : "1");
    } catch {
      // Private mode / blocked site data: the nav still toggles for this view.
    }
    notifyStoredValue();
  }, [storedCollapsed]);

  const displayName = useMemo(() => {
    if (viewer === undefined) return "Loading…";
    if (!viewer) return "Not signed in";
    return viewer.name?.trim() || viewer.email?.split("@")[0] || "Teacher";
  }, [viewer]);

  const displayEmail = useMemo(() => {
    if (viewer === undefined) return "Fetching account";
    if (!viewer) return "Sign in to sync classrooms";
    if (viewer.email?.trim()) return viewer.email.trim();
    return viewer.mode === "local" ? "Local development" : "Google account";
  }, [viewer]);

  return (
    <aside
      className={cn(
        "syncvas-dashboard-nav",
        isDrawer ? "syncvas-dashboard-nav-drawer" : "syncvas-dashboard-nav-rail",
        collapsed && "syncvas-dashboard-nav-collapsed",
      )}
      aria-label="Teacher workspace"
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div className="syncvas-dashboard-nav-top">
        <div className="syncvas-dashboard-nav-brand">
          {/* The mark is the toggle: hovering swaps it for the panel glyph, so the
              rail needs no separate control when collapsed. */}
          {isDrawer ? (
            <span className="syncvas-dashboard-nav-mark" aria-hidden="true">
              <SyncvasMark className="syncvas-dashboard-nav-mark-logo" />
            </span>
          ) : (
            <button
              type="button"
              className="syncvas-dashboard-nav-mark-toggle"
              aria-expanded={!collapsed}
              aria-controls="teacher-workspace-nav-links"
              onClick={toggleCollapsed}
            >
              <span className="syncvas-dashboard-nav-mark" aria-hidden="true">
                <SyncvasMark className="syncvas-dashboard-nav-mark-logo" />
                <PanelIcon className="syncvas-dashboard-nav-mark-panel" />
              </span>
              <span className="syncvas-nav-tip" aria-hidden="true">
                {collapsed ? "Open sidebar" : "Close sidebar"}
              </span>
              <span className="sr-only">{collapsed ? "Open sidebar" : "Close sidebar"}</span>
            </button>
          )}
          {!collapsed ? (
            <div className="min-w-0">
              <p className="syncvas-eyebrow">Workspace</p>
              <p className="mt-1 truncate text-sm font-semibold tracking-[-0.03em]">Classroom studio</p>
            </div>
          ) : null}
        </div>
        {!collapsed && !isDrawer ? (
          <button
            type="button"
            className="syncvas-dashboard-nav-collapse"
            aria-expanded
            aria-controls="teacher-workspace-nav-links"
            data-tooltip="Close sidebar"
            onClick={toggleCollapsed}
          >
            <span aria-hidden="true">⟨</span>
            <span className="sr-only">Close sidebar</span>
          </button>
        ) : null}
      </div>

      {!collapsed ? (
        <p className="syncvas-dashboard-nav-lead">
          Keep every live room, finished canvas, and student signal in one calm place.
        </p>
      ) : null}

      <nav id="teacher-workspace-nav-links" className="syncvas-dashboard-nav-links" aria-label="Dashboard sections">
        {NAV_ITEMS.map((item) => {
          const active = item.match ? item.match(pathname) : pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "syncvas-dashboard-nav-link",
                active && "syncvas-dashboard-nav-link-active",
              )}
              aria-current={active ? "page" : undefined}
            >
              <span className="syncvas-dashboard-nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              {collapsed ? (
                <span className="syncvas-nav-tip" aria-hidden="true">
                  {item.label}
                </span>
              ) : (
                <span className="syncvas-dashboard-nav-label">{item.label}</span>
              )}
              {collapsed ? <span className="sr-only">{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>

      {!collapsed ? (
        <div className="syncvas-dashboard-nav-note">
          <span className="syncvas-live-dot" aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold text-ink">Private by design</p>
            <p className="mt-1 text-xs leading-5 text-ink-muted">Student counts are anonymous room totals.</p>
          </div>
        </div>
      ) : null}

      <div className="syncvas-dashboard-nav-user">
        <div className="syncvas-dashboard-nav-avatar" aria-hidden="true">
          {viewer?.image ? (
            <img src={viewer.image} alt="" className="syncvas-dashboard-nav-avatar-img" />
          ) : (
            <span>{viewer ? initialsFrom(viewer.name, viewer.email) : "SV"}</span>
          )}
        </div>
        {!collapsed ? (
          <div className="syncvas-dashboard-nav-user-copy min-w-0">
            <p className="truncate text-sm font-semibold tracking-[-0.02em] text-ink">{displayName}</p>
            <p className="truncate text-xs text-ink-muted" title={viewer?.email ?? undefined}>
              {displayEmail}
            </p>
          </div>
        ) : null}
        {viewer?.mode === "auth" ? (
          <button
            type="button"
            className="syncvas-dashboard-nav-signout"
            data-tooltip="Sign out"
            onClick={() => void signOut()}
          >
            <span aria-hidden="true">⎋</span>
            <span className="sr-only">Sign out</span>
          </button>
        ) : null}
      </div>
    </aside>
  );
}
