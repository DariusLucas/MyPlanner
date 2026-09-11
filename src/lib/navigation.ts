import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  ChartSpline,
  House,
  UserRound,
} from "lucide-react";

export type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  phase?: string;
};

export const primaryNavigation: NavigationItem[] = [
  { label: "Today", href: "/", icon: House },
  { label: "This Week", href: "/week", icon: CalendarDays },
  { label: "Progress", href: "/progress", icon: ChartSpline },
];

export const utilityNavigation: NavigationItem[] = [
  { label: "Account", href: "/account", icon: UserRound },
];
