"use client";

import Link from "next/link";
import type { Route } from "next";
import { Menu, PanelLeftClose, PanelLeftOpen, Plane, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { primaryNavigation, secondaryNavigation, utilityNavigation, type NavigationItem } from "@/src/lib/navigation";
import { ThemeToggle } from "./theme-toggle";

function NavigationGroup({ label, items, onNavigate }: { label?: string; items: NavigationItem[]; onNavigate: () => void }) {
  const pathname = usePathname();

  return (
    <div className="space-y-1">
      {label && <p className="nav-group-label px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>}
      {items.map(({ label: itemLabel, href, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href as Route}
            onClick={onNavigate}
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const closeMobile = () => setMobileOpen(false);
  const placeholderPage = pathname !== "/" && !pathname.startsWith("/today");

  return (
    <div className="min-h-screen bg-background text-foreground lg:p-3">
      {mobileOpen && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-[1px] lg:hidden" onClick={closeMobile} />}
      <div className="workspace-frame lg:grid" data-sidebar-collapsed={sidebarCollapsed}>
      <aside className={`sidebar-panel fixed inset-y-0 left-0 z-40 flex w-[244px] flex-col bg-sidebar px-3 py-4 backdrop-blur-2xl transition-transform lg:sticky lg:top-3 lg:h-[calc(100vh-1.5rem)] lg:w-auto lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="sidebar-top-brand mb-7 flex h-11 items-center gap-3 px-2" aria-label="Planner">
          <span className="sidebar-plane grid size-9 shrink-0 place-items-center" aria-hidden="true"><Plane size={27} strokeWidth={1.5} /></span>
          <span className="sidebar-brand-copy whitespace-nowrap text-[16px] font-semibold tracking-[-0.04em]">Planner</span>
          <button type="button" aria-label="Close navigation" className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-muted lg:hidden" onClick={closeMobile}><X size={17} /></button>
        </div>

        <div className="sidebar-navigation space-y-7">
          <NavigationGroup items={primaryNavigation} onNavigate={closeMobile} />
          <NavigationGroup label="Later" items={secondaryNavigation} onNavigate={closeMobile} />
        </div>

        <div className="sidebar-footer mt-auto">
          <div className="sidebar-footer-controls border-t border-border pt-3">
            <div className="sidebar-utilities mb-2 flex items-center px-2">
              <div className="theme-slot flex items-center"><ThemeToggle compact={sidebarCollapsed} /></div>
              <button type="button" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} className="sidebar-toggle ml-2 hidden size-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:inline-flex" onClick={() => setSidebarCollapsed((value) => !value)}>{sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</button>
            </div>
            <NavigationGroup items={utilityNavigation} onNavigate={closeMobile} />
          </div>
        </div>
      </aside>

      <div className="content-region min-w-0">
        <header className="workspace-header sticky top-0 z-20 flex h-14 items-center justify-between bg-card/60 px-4 backdrop-blur-2xl lg:hidden">
          <button type="button" aria-label="Open navigation" className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden" onClick={() => { setSidebarCollapsed(false); setMobileOpen(true); }}><Menu size={18} /></button>
        </header>
        <main className={`content-surface w-full px-4 py-7 sm:px-6 lg:px-8 lg:py-9 xl:px-10 xl:py-10 ${placeholderPage ? "placeholder-surface" : ""}`}><div key={pathname} className="page-transition">{children}</div></main>
      </div>
      </div>
    </div>
  );
}
