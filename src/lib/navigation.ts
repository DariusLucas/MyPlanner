import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness,
  CalendarDays,
  ChartSpline,
  Clapperboard,
  House,
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
  { label: "This Week", href: "/week", icon: CalendarDays },
  { label: "Career", href: "/career", icon: BriefcaseBusiness },
  { label: "Content", href: "/content", icon: Clapperboard },
  { label: "Progress", href: "/progress", icon: ChartSpline },
];

export const utilityNavigation: NavigationItem[] = [
  { label: "Settings", href: "/settings", icon: Settings2 },
];
