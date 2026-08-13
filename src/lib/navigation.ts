import type { LucideIcon } from "lucide-react";
import {
  CalendarCheck2,
  ChartNoAxesCombined,
  CircleCheck,
  Compass,
  FileText,
  Flag,
  LayoutDashboard,
  MonitorCog,
  NotebookTabs,
  Sparkles,
  Target,
} from "lucide-react";

export type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  phase?: string;
};

export const primaryNavigation: NavigationItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Today", href: "/today", icon: CalendarCheck2, phase: "Phase 2" },
  { label: "Goals", href: "/goals", icon: Target, phase: "Phase 3" },
  { label: "Plan", href: "/plan", icon: NotebookTabs, phase: "Phase 3" },
];

export const secondaryNavigation: NavigationItem[] = [
  { label: "Career", href: "/career", icon: Compass, phase: "Phase 4" },
  { label: "Content", href: "/content", icon: Sparkles, phase: "Phase 5" },
  { label: "Progress", href: "/progress", icon: ChartNoAxesCombined, phase: "Phase 6" },
  { label: "Review", href: "/review", icon: FileText, phase: "Phase 7" },
];

export const utilityNavigation: NavigationItem[] = [
  { label: "Settings", href: "/settings", icon: MonitorCog },
];

export const foundationStats = [
  { label: "Schema", value: "SQLite + Drizzle", icon: CircleCheck },
  { label: "Current phase", value: "Foundation", icon: Flag },
];
