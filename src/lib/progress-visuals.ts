import {
  addDays,
  addMonths,
  addWeeks,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
  startOfMonth,
  subMonths,
  subYears,
} from "date-fns";
import type {
  ProgressCategory,
  ProgressData,
} from "@/src/lib/progress";

export const progressRangeKeys = ["3m", "6m", "1y", "all"] as const;
export type ProgressRangeKey = (typeof progressRangeKeys)[number];
export type ProgressCategoryFilter = "all" | ProgressCategory;
export type ProgressGrouping = "day" | "week" | "month";

export type ProgressPeriod = {
  key: string;
  label: string;
  completed: number;
  planned: number;
  plannedCompleted: number;
  completionRate: number;
  productiveDays: number;
  categoryCounts: Record<ProgressCategory, number>;
};

export type HeatmapDay = {
  date: string;
  inRange: boolean;
  completed: number;
  categoryCounts: Record<ProgressCategory, number>;
};

export function normalizeProgressRange(value?: string | string[]): ProgressRangeKey {
  const candidate = Array.isArray(value) ? value[0] : value;
  return progressRangeKeys.includes(candidate as ProgressRangeKey)
    ? candidate as ProgressRangeKey
    : "3m";
}

export function normalizeProgressCategory(
  value?: string | string[],
): ProgressCategoryFilter {
  const candidate = Array.isArray(value) ? value[0] : value;
  return ["all", "career", "content", "personal"].includes(candidate ?? "")
    ? candidate as ProgressCategoryFilter
    : "all";
}

export function progressRangeStart(range: ProgressRangeKey, today: string) {
  const date = parseISO(today);
  if (range === "3m") return format(addDays(subMonths(date, 3), 1), "yyyy-MM-dd");
  if (range === "6m") return format(addDays(subMonths(date, 6), 1), "yyyy-MM-dd");
  if (range === "1y") return format(addDays(subYears(date, 1), 1), "yyyy-MM-dd");
  return undefined;
}

export function progressGrouping(range: ProgressRangeKey): ProgressGrouping {
  // Keep the default short range aligned with the heatmap: completed work is
  // shown on the local calendar day it was completed, not the week start.
  if (range === "3m") return "day";
  if (range === "6m") return "week";
  return "month";
}

function emptyCategoryCounts(): Record<ProgressCategory, number> {
  return { career: 0, content: 0, personal: 0 };
}

export function buildProgressPeriods(
  data: ProgressData,
  grouping: ProgressGrouping,
): ProgressPeriod[] {
  const periods = new Map<string, ProgressPeriod>();

  const firstDate = data.range.startDate ?? data.daily[0]?.date;
  if (firstDate) {
    const first = grouping === "day"
      ? parseISO(firstDate)
      : grouping === "week"
        ? startOfWeek(parseISO(firstDate), { weekStartsOn: 1 })
        : startOfMonth(parseISO(firstDate));
    const end = parseISO(data.range.endDate);
    for (
      let date = first;
      date <= end;
      date = grouping === "day"
        ? addDays(date, 1)
        : grouping === "week"
          ? addWeeks(date, 1)
          : addMonths(date, 1)
    ) {
      const key = format(
        date,
        grouping === "day" ? "yyyy-MM-dd" : grouping === "week" ? "yyyy-MM-dd" : "yyyy-MM",
      );
      periods.set(key, {
        key,
        label: format(date, grouping === "day" || grouping === "week" ? "MMM d" : "MMM yyyy"),
        completed: 0,
        planned: 0,
        plannedCompleted: 0,
        completionRate: 0,
        productiveDays: 0,
        categoryCounts: emptyCategoryCounts(),
      });
    }
  }

  for (const day of data.daily) {
    const date = parseISO(day.date);
    const key = grouping === "day"
      ? format(date, "yyyy-MM-dd")
      : grouping === "week"
        ? format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd")
        : format(date, "yyyy-MM");
    const label = grouping === "day" || grouping === "week"
      ? format(parseISO(key), "MMM d")
      : format(date, "MMM yyyy");
    const period = periods.get(key) ?? {
      key,
      label,
      completed: 0,
      planned: 0,
      plannedCompleted: 0,
      completionRate: 0,
      productiveDays: 0,
      categoryCounts: emptyCategoryCounts(),
    };
    period.completed += day.completed;
    period.planned += day.planned;
    period.plannedCompleted += day.plannedCompleted;
    period.productiveDays += day.productive ? 1 : 0;
    period.categoryCounts.career += day.categoryCounts.career;
    period.categoryCounts.content += day.categoryCounts.content;
    period.categoryCounts.personal += day.categoryCounts.personal;
    periods.set(key, period);
  }

  for (const period of periods.values()) {
    period.completionRate = period.planned === 0
      ? 0
      : Number(((period.plannedCompleted / period.planned) * 100).toFixed(1));
  }

  return [...periods.values()].sort((left, right) => left.key.localeCompare(right.key));
}

export function buildHeatmap(data: ProgressData, maximumWeeks = 53): HeatmapDay[] {
  const end = parseISO(data.range.endDate);
  const windowStart = addDays(end, -(maximumWeeks * 7 - 1));
  const requestedStart = data.range.startDate ? parseISO(data.range.startDate) : windowStart;
  const rangeStart = requestedStart > windowStart ? requestedStart : windowStart;
  const gridStart = startOfWeek(rangeStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(end, { weekStartsOn: 1 });
  const byDate = new Map(data.daily.map((day) => [day.date, day]));
  const days: HeatmapDay[] = [];

  for (let date = gridStart; date <= gridEnd; date = addDays(date, 1)) {
    const key = format(date, "yyyy-MM-dd");
    const day = byDate.get(key);
    const inRange = date >= rangeStart && date <= end;
    days.push({
      date: key,
      inRange,
      completed: inRange ? day?.completed ?? 0 : 0,
      categoryCounts: inRange ? day?.categoryCounts ?? emptyCategoryCounts() : emptyCategoryCounts(),
    });
  }

  return days;
}
