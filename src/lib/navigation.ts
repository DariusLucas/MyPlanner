import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness,
  CalendarDays,
  ChartSpline,
  Clapperboard,
  CircleCheck,
  Crosshair,
  Flag,
  House,
  ListTodo,
  NotebookPen,
  Settings2,
} from "lucide-react";

export type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  phase?: string;
};

export const primaryNavigation: NavigationItem[] = [
  { label: "Dashboard", href: "/", icon: House },
  { label: "Today", href: "/today", icon: CalendarDays },
];

export const secondaryNavigation: NavigationItem[] = [
  { label: "Goals", href: "/goals", icon: Crosshair, phase: "Phase 3" },
  { label: "Plan", href: "/plan", icon: ListTodo, phase: "Phase 3" },
  { label: "Career", href: "/career", icon: BriefcaseBusiness, phase: "Phase 4" },
  { label: "Content", href: "/content", icon: Clapperboard, phase: "Phase 5" },
  { label: "Progress", href: "/progress", icon: ChartSpline, phase: "Phase 6" },
  { label: "Review", href: "/review", icon: NotebookPen, phase: "Phase 7" },
];

export const utilityNavigation: NavigationItem[] = [
  { label: "Settings", href: "/settings", icon: Settings2 },
];

export const foundationStats = [
  { label: "Schema", value: "SQLite + Drizzle", icon: CircleCheck },
  { label: "Current phase", value: "Foundation", icon: Flag },
];
