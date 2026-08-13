"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState } from "react";
import { primaryNavigation, secondaryNavigation, utilityNavigation, type NavigationItem } from "@/src/lib/navigation";
import { ThemeToggle } from "./theme-toggle";

function NavigationLinks({ items, collapsed, onNavigate }: { items: NavigationItem[]; collapsed: boolean; onNavigate: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1" aria-label="Application navigation">
      {items.map(({ label, href, icon: Icon, phase }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href as Route}
            onClick={onNavigate}
            title={collapsed ? `${label}${phase ? ` · ${phase}` : ""}` : undefined}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon size={17} strokeWidth={1.8} className="shrink-0" />
            {!collapsed && <span className="flex min-w-0 flex-1 items-center justify-between gap-2"><span>{label}</span>{phase && <span className={active ? "text-background/60 text-[10px]" : "text-[10px] text-muted-foreground"}>{phase}</span>}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <button type="button" className="fixed inset-0 z-30 bg-black/30 md:hidden" aria-label="Close navigation" hidden={!mobileOpen} onClick={() => setMobileOpen(false)} />
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-border bg-sidebar px-4 py-5 transition-transform md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} ${collapsed ? "md:w-[76px]" : ""}`}>
        <div className={`mb-8 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
          <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="grid size-9 place-items-center rounded-xl bg-foreground text-background text-sm font-semibold">MP</span>
            {!collapsed && <span><span className="block text-sm font-semibold tracking-tight">My Planner</span><span className="block text-xs text-muted-foreground">Personal progress system</span></span>}
          </Link>
          {!collapsed && <button type="button" className="hidden rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:block" onClick={() => setCollapsed(true)} aria-label="Collapse sidebar"><PanelLeftClose size={17} /></button>}
        </div>

        {collapsed && <button type="button" className="mb-4 hidden self-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:block" onClick={() => setCollapsed(false)} aria-label="Expand sidebar"><PanelLeftOpen size={17} /></button>}

        <div className="space-y-6">
          <NavigationLinks items={primaryNavigation} collapsed={collapsed} onNavigate={() => setMobileOpen(false)} />
          <div className="border-t border-border pt-5"><NavigationLinks items={secondaryNavigation} collapsed={collapsed} onNavigate={() => setMobileOpen(false)} /></div>
        </div>

        <div className="mt-auto space-y-4">
          <NavigationLinks items={utilityNavigation} collapsed={collapsed} onNavigate={() => setMobileOpen(false)} />
          {!collapsed && <p className="px-3 text-[11px] leading-5 text-muted-foreground">Local-first. No analytics, tracking, or cloud sync.</p>}
        </div>
      </aside>

      <div className={`min-h-screen transition-[padding] md:pl-[272px] ${collapsed ? "md:pl-[76px]" : ""}`}>
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/80 bg-background/95 px-5 backdrop-blur md:px-8">
          <button type="button" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><PanelLeftOpen size={19} /></button>
          <div className="hidden md:block" />
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-5 py-8 md:px-8 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
