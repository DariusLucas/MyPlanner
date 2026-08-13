"use client";

import Link from "next/link";
import type { Route } from "next";
import { Menu, PanelLeftClose, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { primaryNavigation, secondaryNavigation, utilityNavigation, type NavigationItem } from "@/src/lib/navigation";
import { ThemeToggle } from "./theme-toggle";

function NavigationGroup({ label, items, onNavigate }: { label?: string; items: NavigationItem[]; onNavigate: () => void }) {
  const pathname = usePathname();

  return (
    <div className="space-y-1">
      {label && <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>}
      {items.map(({ label: itemLabel, href, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href as Route}
            onClick={onNavigate}
            className={`flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon size={16} strokeWidth={1.8} />
            <span className="min-w-0 flex-1">{itemLabel}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {mobileOpen && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-[1px] md:hidden" onClick={closeMobile} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-border bg-sidebar px-3 py-4 transition-transform md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="mb-6 flex items-center justify-between px-2">
          <Link href="/" onClick={closeMobile} className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="grid size-8 place-items-center rounded-lg bg-foreground text-[11px] font-bold text-background">MP</span>
            <span className="text-sm font-semibold tracking-tight">My Planner</span>
          </Link>
          <button type="button" aria-label="Close navigation" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted md:hidden" onClick={closeMobile}><X size={17} /></button>
        </div>

        <div className="space-y-6">
          <NavigationGroup items={primaryNavigation} onNavigate={closeMobile} />
          <NavigationGroup label="Later" items={secondaryNavigation} onNavigate={closeMobile} />
        </div>

        <div className="mt-auto border-t border-border pt-3">
          <NavigationGroup items={utilityNavigation} onNavigate={closeMobile} />
          <p className="px-3 pt-3 text-[11px] leading-4 text-muted-foreground">Private, local, and yours.</p>
        </div>
      </aside>

      <div className="min-h-screen md:pl-[240px]">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:px-7">
          <button type="button" aria-label="Open navigation" className="rounded-md p-2 text-muted-foreground hover:bg-muted md:hidden" onClick={() => setMobileOpen(true)}><Menu size={18} /></button>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex"><PanelLeftClose size={14} /> Personal workspace</div>
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-[1080px] px-4 py-6 sm:px-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
