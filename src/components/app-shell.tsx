"use client";

import Link from "next/link";
import type { Route } from "next";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plane, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { primaryNavigation, utilityNavigation, type NavigationItem } from "@/src/lib/navigation";
import { ThemeToggle } from "./theme-toggle";

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);

  useEffect(() => setPendingHref(null), [pathname]);
  useEffect(() => {
    if (!signOutOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSignOutOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [signOutOpen]);

  const navigate = (href: string) => {
    setPendingHref(href === pathname ? null : href);
    closeMobile();
  };

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="min-h-screen bg-background text-foreground lg:p-3">
      {mobileOpen && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-[1px] lg:hidden" onClick={closeMobile} />}
      <div className="workspace-frame lg:grid" data-sidebar-collapsed={sidebarCollapsed}>
      <aside className={`sidebar-panel fixed inset-y-0 left-0 z-40 flex w-[244px] flex-col bg-sidebar px-3 py-4 transition-transform lg:sticky lg:top-3 lg:h-[calc(100vh-1.5rem)] lg:w-auto lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="sidebar-top-brand mb-7 flex h-11 items-center gap-3 px-2" aria-label="Planner">
          <span className="sidebar-plane grid size-9 shrink-0 place-items-center" aria-hidden="true"><Plane size={27} strokeWidth={1.5} /></span>
          <span className="sidebar-brand-copy whitespace-nowrap text-[16px] font-semibold tracking-[-0.04em]">Planner</span>
          <button type="button" aria-label="Close navigation" className="mobile-nav-button ml-auto rounded-xl text-muted-foreground hover:bg-muted lg:hidden" onClick={closeMobile}><X size={18} /></button>
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
        <header className="workspace-header sticky top-0 z-20 flex h-14 items-center justify-between bg-card/95 px-4 lg:hidden">
          <button type="button" aria-label="Open navigation" className="mobile-nav-button rounded-xl text-muted-foreground hover:bg-muted lg:hidden" onClick={() => { setSidebarCollapsed(false); setMobileOpen(true); }}><Menu size={19} /></button>
          <div className="workspace-mobile-brand" aria-label="Planner"><span className="workspace-mobile-brand-mark"><Plane size={16} strokeWidth={1.7} /></span><span>Planner</span></div>
          <span className="workspace-mobile-caption">Today</span>
        </header>
        <main className="content-surface w-full px-4 py-7 sm:px-6 lg:px-8 lg:py-9 xl:px-10 xl:py-10">
          {pendingHref && pendingHref !== pathname && <div className="route-progress" role="status" aria-label="Loading page"><span /></div>}
          <div key={pathname} className="page-transition">{children}</div>
        </main>
      </div>
      </div>

      {signOutOpen && signOutAction && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSignOutOpen(false)}>
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="sign-out-title" aria-describedby="sign-out-description">
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
