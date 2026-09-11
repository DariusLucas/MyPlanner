import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bike,
  BookOpen,
  BriefcaseBusiness,
  Camera,
  Clapperboard,
  Code2,
  Coffee,
  Dumbbell,
  GraduationCap,
  Heart,
  Home,
  Languages,
  Lightbulb,
  Microscope,
  Music2,
  Palette,
  PawPrint,
  Plane,
  Sprout,
  Target,
  Trophy,
  UsersRound,
  WalletCards,
} from "lucide-react";

export const categoryIconNames = [
  "briefcase", "clapperboard", "dumbbell", "graduation-cap", "heart", "home",
  "book-open", "code", "palette", "music", "plane", "wallet", "people",
  "sprout", "target", "trophy", "camera", "bike", "activity", "coffee",
  "languages", "lightbulb", "microscope", "paw-print",
] as const;

export type CategoryIconName = (typeof categoryIconNames)[number];
export const categoryColorNames = ["orange", "blue", "green", "purple", "rose", "gold", "teal", "slate"] as const;
export type CategoryColorName = (typeof categoryColorNames)[number];
export const categoryColors: Record<CategoryColorName, string> = { orange: "#d97745", blue: "#5f7187", green: "#6d8262", purple: "#8a6f85", rose: "#b86b72", gold: "#a87345", teal: "#577f82", slate: "#6f6d93" };

export type PlannerCategory = {
  id: string;
  name: string;
  icon: CategoryIconName;
  color: CategoryColorName;
  position: number;
  archivedAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export const categoryIcons: Record<CategoryIconName, LucideIcon> = {
  briefcase: BriefcaseBusiness,
  clapperboard: Clapperboard,
  dumbbell: Dumbbell,
  "graduation-cap": GraduationCap,
  heart: Heart,
  home: Home,
  "book-open": BookOpen,
  code: Code2,
  palette: Palette,
  music: Music2,
  plane: Plane,
  wallet: WalletCards,
  people: UsersRound,
  sprout: Sprout,
  target: Target,
  trophy: Trophy,
  camera: Camera,
  bike: Bike,
  activity: Activity,
  coffee: Coffee,
  languages: Languages,
  lightbulb: Lightbulb,
  microscope: Microscope,
  "paw-print": PawPrint,
};

export const categoryIconLabels: Record<CategoryIconName, string> = {
  briefcase: "Work",
  clapperboard: "Content",
  dumbbell: "Gym",
  "graduation-cap": "University",
  heart: "Wellbeing",
  home: "Home",
  "book-open": "Reading",
  code: "Coding",
  palette: "Creative",
  music: "Music",
  plane: "Travel",
  wallet: "Money",
  people: "People",
  sprout: "Growth",
  target: "Goals",
  trophy: "Sport",
  camera: "Photography",
  bike: "Cycling",
  activity: "Health",
  coffee: "Personal",
  languages: "Languages",
  lightbulb: "Ideas",
  microscope: "Research",
  "paw-print": "Pets",
};

export function categoryName(categories: PlannerCategory[], id: string) {
  return categories.find((category) => category.id === id)?.name ?? "Archived category";
}

export function categoryIcon(name: string): LucideIcon {
  return categoryIcons[name as CategoryIconName] ?? Target;
}
