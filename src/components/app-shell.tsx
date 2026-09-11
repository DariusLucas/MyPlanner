"use client";

import Link from "next/link";
import type { Route } from "next";
import { LogOut, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Plane, Plus, Shapes, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { primaryNavigation, utilityNavigation, type NavigationItem } from "@/src/lib/navigation";
import { ThemeToggle } from "./theme-toggle";
import { useDialogContract } from "./interaction-primitives";
import { useCategories } from "./category-context";
import { CategoryDialog } from "./category-dialog";
import { categoryIcon, type PlannerCategory } from "@/src/lib/categories";

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
  const categories = useCategories();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PlannerCategory | null>(null);
  const [categoryCanScrollDown, setCategoryCanScrollDown] = useState(false);
  const categoryListRef = useRef<HTMLDivElement>(null);
  const [spacesOpen, setSpacesOpen] = useState(false);
  const [spacesClosing, setSpacesClosing] = useState(false);
  const spacesCloseTimerRef = useRef<number | null>(null);
  const signOutDialogRef = useDialogContract<HTMLElement>({ active: signOutOpen, onClose: () => setSignOutOpen(false) });
  const closeSpacesAnimated = () => {
    if (!spacesOpen || spacesClosing) return;
    setSpacesClosing(true);
    spacesCloseTimerRef.current = window.setTimeout(() => {
      setSpacesOpen(false);
      setSpacesClosing(false);
      spacesCloseTimerRef.current = null;
    }, 220);
  };
  const openSpaces = () => {
    if (spacesCloseTimerRef.current !== null) {
      window.clearTimeout(spacesCloseTimerRef.current);
      spacesCloseTimerRef.current = null;
    }
    setSpacesClosing(false);
    setSpacesOpen(true);
  };
  const spacesDialogRef = useDialogContract<HTMLElement>({ active: spacesOpen, onClose: closeSpacesAnimated });

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => () => {
    if (spacesCloseTimerRef.current !== null) window.clearTimeout(spacesCloseTimerRef.current);
  }, []);

  useEffect(() => {
    const list = categoryListRef.current;
    if (!list) return;
    const updateScrollCue = () => {
      const maxScroll = list.scrollHeight - list.clientHeight;
      setCategoryCanScrollDown(maxScroll - list.scrollTop > 4);
    };
    updateScrollCue();
    list.addEventListener("scroll", updateScrollCue, { passive: true });
    const observer = new ResizeObserver(updateScrollCue);
    observer.observe(list);
    return () => { list.removeEventListener("scroll", updateScrollCue); observer.disconnect(); };
  }, [categories.length]);

  const navigate = (href: string) => {
    setPendingHref(href === pathname ? null : href);
  };

  const visualPathname = pendingHref ?? pathname;
  const mobilePagesActive = spacesOpen || spacesClosing;
  const categoryNavigation: NavigationItem[] = categories.map((category) => ({
    label: category.name,
    href: `/category/${category.id}`,
    icon: categoryIcon(category.icon),
  }));
  const activeCategory = categories.find((category) => visualPathname === `/category/${category.id}`);
  const SpacesIcon = activeCategory ? categoryIcon(activeCategory.icon) : Shapes;

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
          <div className="sidebar-category-group mt-5 border-t border-border pt-4">
            <div className="mb-2 flex items-center justify-between gap-2 px-3">
              <p className="nav-group-label text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Your pages</p>
              <button type="button" className="sidebar-category-add-icon" onClick={() => setCategoryDialogOpen(true)} aria-label="Create category" title="Create category"><Plus size={14} /></button>
            </div>
            <div className="sidebar-category-scroll">
              {categoryNavigation.length ? <div className="sidebar-category-list-wrap"><div className={`sidebar-scroll-cue ${categoryCanScrollDown ? "sidebar-scroll-cue-visible" : ""}`} aria-hidden="true" /><div ref={categoryListRef} className="space-y-1">{categories.map((category) => { const Icon = categoryIcon(category.icon); const href = `/category/${category.id}`; const active = visualPathname.startsWith(href); return <div key={category.id} className={`category-nav-row nav-item ${active ? "category-nav-row-active" : ""}`}><Link href={href as Route} prefetch onClick={() => navigate(href)} title={category.name} className="category-nav-link flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Icon size={17} strokeWidth={1.65} /><span className="nav-label min-w-0 flex-1 truncate whitespace-nowrap">{category.name}</span></Link><button type="button" className="category-nav-menu-button" aria-label={`Edit ${category.name}`} title={`Edit ${category.name}`} onClick={() => setEditingCategory(category)}><MoreHorizontal size={16} /></button></div>; })}</div></div> : <button type="button" onClick={() => setCategoryDialogOpen(true)} className="sidebar-category-empty"><span className="grid size-8 place-items-center rounded-xl bg-accent text-accent-foreground"><Plus size={15} /></span><span><strong>Add a category</strong><small>Gym, work, study…</small></span></button>}
            </div>
            {categoryNavigation.length ? <button type="button" onClick={() => setCategoryDialogOpen(true)} className="sidebar-new-category"><Plus size={15} /><span className="nav-label">New category</span></button> : null}
          </div>
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
          {primaryNavigation.map(({ label, href, icon: Icon }) => {
            const active = !mobilePagesActive && (href === "/" ? visualPathname === "/" : visualPathname.startsWith(href));
            const mobileLabel = href === "/week" ? "This Week" : label;
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
                onClick={() => { closeSpacesAnimated(); navigate(href); }}
              >
                <Icon size={19} strokeWidth={active ? 2 : 1.65} />
                <span>{mobileLabel}</span>
              </Link>
            );
          })}
          <button type="button" aria-current={activeCategory && !mobilePagesActive ? "page" : undefined} aria-label="Open Pages" title="Pages" className="mobile-bottom-nav-item" data-active={Boolean(activeCategory || mobilePagesActive)} onClick={openSpaces}>
            <SpacesIcon size={19} strokeWidth={mobilePagesActive || activeCategory ? 2 : 1.65} />
            <span>{activeCategory?.name ?? "Pages"}</span>
          </button>
          {utilityNavigation.map(({ label, href, icon: Icon }) => {
            const active = !mobilePagesActive && visualPathname.startsWith(href);
            return <Link key={href} href={href as Route} prefetch aria-current={active ? "page" : undefined} aria-label={label} title={label} className="mobile-bottom-nav-item" data-active={active} onClick={() => { closeSpacesAnimated(); navigate(href); }}><Icon size={19} strokeWidth={active ? 2 : 1.65} /><span>{label}</span></Link>;
          })}
        </div>
      </nav>

      {(spacesOpen || spacesClosing) && (
        <div className={`modal-backdrop mobile-spaces-backdrop ${spacesClosing ? "mobile-spaces-backdrop-closing" : ""}`} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeSpacesAnimated()}>
          <section ref={spacesDialogRef} tabIndex={-1} className={`mobile-spaces-sheet ${spacesClosing ? "mobile-spaces-sheet-closing" : ""}`} role="dialog" aria-modal="true" aria-labelledby="spaces-title">
            <div className="flex items-center justify-between gap-3"><div><p className="dashboard-eyebrow">Navigate</p><h2 id="spaces-title" className="mt-1 text-xl font-semibold">Pages</h2></div><button type="button" className="milestone-icon-button" onClick={closeSpacesAnimated} aria-label="Close Pages"><X size={17} /></button></div>
            <div className="mobile-spaces-list">
              {categories.length ? categories.map((category) => { const Icon = categoryIcon(category.icon); const active = category.id === activeCategory?.id; return <Link key={category.id} href={`/category/${category.id}` as Route} className="mobile-space-row" data-active={active} onClick={() => { closeSpacesAnimated(); navigate(`/category/${category.id}`); }}><span><Icon size={19} /></span><strong>{category.name}</strong></Link>; }) : <div className="mobile-spaces-empty"><Shapes size={22} /><p>No categories yet.</p><small>Create one for any part of life you want to move forward.</small></div>}
            </div>
            <button type="button" className="premium-primary-button w-full justify-center" onClick={() => { closeSpacesAnimated(); setCategoryDialogOpen(true); }}><Plus size={16} /> New category</button>
          </section>
        </div>
      )}

      <CategoryDialog open={categoryDialogOpen} onClose={() => setCategoryDialogOpen(false)} />
      <CategoryDialog open={Boolean(editingCategory)} category={editingCategory ?? undefined} onClose={() => setEditingCategory(null)} onDeleted={() => setEditingCategory(null)} />

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
