"use client";

import Link from "next/link";
import type { Route } from "next";
import { LogOut, PanelLeftClose, PanelLeftOpen, Plane, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { primaryNavigation, utilityNavigation, type NavigationItem } from "@/src/lib/navigation";
import { ThemeToggle } from "./theme-toggle";
import { useDialogContract } from "./interaction-primitives";

function NavigationGroup({ label, items, onNavigate, pendingHref }: { label?: string; items: NavigationItem[]; onNavigate: (href: string) => void; pendingHref: string | null }) {
  const pathname = usePathname();
  const visualPathname = pendingHref ?? pathname;

  return (
    <div className="space-y-1">
      {label && <p className="nav-group-label px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>}
      {items.map(({ label: itemLabel, href, icon: Icon }) => {
        const active = href === "/" ? visualPathname === "/" : visualPathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href as Route}
            prefetch
            onClick={() => onNavigate(href)}
            title={itemLabel}
            className={`nav-item flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active ? "nav-item-active font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon size={17} strokeWidth={1.65} />
            <span className="nav-label min-w-0 flex-1 whitespace-nowrap">{itemLabel}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function AppShell({ children, signOutAction, userEmail }: { children: React.ReactNode; signOutAction?: () => Promise<void>; userEmail?: string | null }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const signOutDialogRef = useDialogContract<HTMLElement>({ active: signOutOpen, onClose: () => setSignOutOpen(false) });

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const navigate = (href: string) => {
    setPendingHref(href === pathname ? null : href);
  };

  const visualPathname = pendingHref ?? pathname;
  const mobileNavigation = [...primaryNavigation, ...utilityNavigation];

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="min-h-screen bg-background text-foreground lg:p-3">
      <div className="workspace-frame lg:grid" data-sidebar-collapsed={sidebarCollapsed}>
      <aside className="sidebar-panel fixed inset-y-0 left-0 z-40 hidden w-[244px] flex-col bg-sidebar px-3 py-4 lg:sticky lg:top-3 lg:flex lg:h-[calc(100vh-1.5rem)] lg:w-auto lg:translate-x-0">
        <div className="sidebar-top-brand mb-7 flex h-11 items-center gap-3 px-2" aria-label="Planner">
          <span className="sidebar-plane grid size-9 shrink-0 place-items-center" aria-hidden="true"><Plane size={27} strokeWidth={1.5} /></span>
          <span className="sidebar-brand-copy whitespace-nowrap text-[16px] font-semibold tracking-[-0.04em]">Planner</span>
        </div>

        <div className="sidebar-navigation">
          <NavigationGroup items={primaryNavigation} onNavigate={navigate} pendingHref={pendingHref} />
        </div>

        <div className="sidebar-footer mt-auto">
          {userEmail && (
            <div className="sidebar-account px-3 pb-3" title={userEmail}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Signed in as</p>
              <p className="sidebar-account-email mt-1 truncate text-xs font-medium text-foreground/80">{userEmail}</p>
            </div>
          )}
          <div className="sidebar-footer-controls border-t border-border pt-3">
            <div className="sidebar-utilities mb-2 flex items-center px-2">
              <div className="theme-slot flex items-center"><ThemeToggle compact={sidebarCollapsed} /></div>
              <button type="button" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} className="sidebar-toggle ml-2 hidden size-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:inline-flex" onClick={() => setSidebarCollapsed((value) => !value)}>{sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</button>
            </div>
            <NavigationGroup items={utilityNavigation} onNavigate={navigate} pendingHref={pendingHref} />
            {signOutAction && (
              <button
                type="button"
                title="Sign out"
                className="nav-item mt-1 flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setSignOutOpen(true)}
              >
                <LogOut size={17} strokeWidth={1.65} />
                <span className="nav-label min-w-0 flex-1 whitespace-nowrap text-left">Sign out</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      <div className="content-region min-w-0">
        <main className="content-surface w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-9 xl:px-10 xl:py-10">
          {pendingHref && pendingHref !== pathname && <div className="route-progress" role="status" aria-label="Loading page"><span /></div>}
          <div key={pathname} className="page-transition">{children}</div>
        </main>
      </div>
      </div>

      <nav className="mobile-bottom-nav lg:hidden" aria-label="Primary navigation">
        <div className="mobile-bottom-nav-track">
          {mobileNavigation.map(({ label, href, icon: Icon }) => {
            const active = href === "/" ? visualPathname === "/" : visualPathname.startsWith(href);
            const MobileIcon = href === "/settings" ? UserRound : Icon;
            const mobileLabel = href === "/week" ? "Week" : label;
            return (
              <Link
                key={href}
                href={href as Route}
                prefetch
                aria-current={active ? "page" : undefined}
                aria-label={label}
                title={label}
                className="mobile-bottom-nav-item"
                data-active={active}
                onClick={() => navigate(href)}
              >
                <MobileIcon size={19} strokeWidth={active ? 2 : 1.65} />
                <span>{mobileLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {signOutOpen && signOutAction && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSignOutOpen(false)}>
          <section ref={signOutDialogRef} tabIndex={-1} className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="sign-out-title" aria-describedby="sign-out-description">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground"><LogOut size={18} /></span>
              <div>
                <p className="confirm-dialog-kicker">Account</p>
                <h2 id="sign-out-title" className="mt-1 text-lg font-semibold tracking-[-0.03em]">Sign out?</h2>
                <p id="sign-out-description" className="mt-2 text-sm leading-6 text-muted-foreground">Are you sure you want to sign out of this planner?</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" autoFocus className="thought-quiet-button" onClick={() => setSignOutOpen(false)}>Cancel</button>
              <form action={signOutAction}><button className="premium-small-button">Sign out</button></form>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
