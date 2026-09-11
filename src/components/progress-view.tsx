"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Activity,
  CalendarCheck2,
  CalendarRange,
  CheckCircle2,
  CircleGauge,
  Flame,
  SlidersHorizontal,
} from "lucide-react";
import { eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { calculateProgress, type ProgressData, type ProgressTask } from "@/src/lib/progress";
import {
  buildHeatmap,
  buildProgressPeriods,
  normalizeProgressCategories,
  normalizeProgressRange,
  progressGrouping,
  progressRangeKeys,
  progressRangeStart,
  type HeatmapDay,
  type ProgressPeriod,
  type ProgressRangeKey,
} from "@/src/lib/progress-visuals";
import { categoryColors, type PlannerCategory } from "@/src/lib/categories";

const rangeLabels: Record<ProgressRangeKey, string> = {
  "3m": "3 months",
  "6m": "6 months",
  "1y": "1 year",
  all: "All time",
};
const chartColors = ["var(--orange)", "#5f7187", "#a87345", "#6d8262", "#8a6f85", "#577f82", "#89784f", "#6f6d93"];

function categoryEntries(categories: PlannerCategory[], counts: Record<string, number>) {
  const known = categories.map((category, index) => ({ id: category.id, name: category.name, color: categoryColors[category.color] ?? chartColors[index % chartColors.length]! }));
  const knownIds = new Set(known.map((category) => category.id));
  const extra = Object.keys(counts).filter((id) => !knownIds.has(id) && ((counts[id] ?? 0) > 0 || categories.length === 0)).map((id, index) => ({ id, name: id === "personal" ? "Personal" : id === "career" ? "Career" : id === "content" ? "Content" : "Archived category", color: chartColors[(known.length + index) % chartColors.length]! }));
  return [...known, ...extra];
}
type ProgressViewProps = {
  range: ProgressRangeKey;
  category?: string;
  selectedCategories?: string[];
  categories?: PlannerCategory[];
} & (
  | { taskHistory: ProgressTask[]; today: string; timeZone: string; data?: never }
  | { data: ProgressData; taskHistory?: never; today?: never; timeZone?: never }
);

function browserFilterParams() {
  const hash = window.location.hash;
  if (hash.startsWith("#/")) {
    return new URLSearchParams(hash.split("?", 2)[1] ?? "");
  }
  return new URLSearchParams(window.location.search);
}

export function ProgressView(props: ProgressViewProps) {
  const { range } = props;
  const taskHistory = "taskHistory" in props ? props.taskHistory : undefined;
  const today = "today" in props ? props.today : undefined;
  const timeZone = "timeZone" in props ? props.timeZone : undefined;
  const suppliedData = "data" in props ? props.data : undefined;
  const suppliedCategoryKeys = suppliedData ? Object.keys(suppliedData.categoryCounts) : [];
  const categories = props.categories ?? suppliedCategoryKeys.map((id, position) => ({ id, name: id === "personal" ? "Personal" : id.charAt(0).toUpperCase() + id.slice(1), icon: "target" as const, color: "orange" as const, position, archivedAt: null, revision: 1, createdAt: "", updatedAt: "" }));
  const initialCategories = props.selectedCategories ?? (props.category && props.category !== "all" ? [props.category] : []);
  const [filters, setFilters] = useState({ range, categories: initialCategories });

  useEffect(() => {
    setFilters({ range, categories: props.selectedCategories ?? (props.category && props.category !== "all" ? [props.category] : []) });
  }, [range, props.category, props.selectedCategories]);

  useEffect(() => {
    function restoreFiltersFromUrl() {
      const params = browserFilterParams();
      setFilters({
        range: normalizeProgressRange(params.get("range") ?? undefined),
        categories: normalizeProgressCategories(params.get("categories") ?? params.get("category") ?? undefined),
      });
    }
    window.addEventListener("popstate", restoreFiltersFromUrl);
    window.addEventListener("hashchange", restoreFiltersFromUrl);
    return () => {
      window.removeEventListener("popstate", restoreFiltersFromUrl);
      window.removeEventListener("hashchange", restoreFiltersFromUrl);
    };
  }, []);

  const data = useMemo(
    () => taskHistory && today && timeZone
      ? calculateProgress(taskHistory, {
          startDate: progressRangeStart(filters.range, today),
          today,
          timeZone,
          categories: filters.categories,
        })
      : suppliedData!,
    [filters, suppliedData, taskHistory, timeZone, today],
  );
  const grouping = progressGrouping(filters.range);
  const periods = buildProgressPeriods(data, grouping);
  const monthly = buildProgressPeriods(data, "month");
  const hasHistory = data.tasksPlanned > 0 || data.completedTasks > 0;
  const selectedNames = categories.filter((category) => filters.categories.includes(category.id)).map((category) => category.name);
  const visibleCategories = filters.categories.length ? categories.filter((category) => filters.categories.includes(category.id)) : categories;
  const filterDescription = `${rangeLabels[filters.range]} · ${selectedNames.length ? selectedNames.join(", ") : "All pages"}`;

  function updateFilters(next: typeof filters) {
    if (next.range === filters.range && next.categories.join(",") === filters.categories.join(",")) return;
    setFilters(next);
    if (window.location.hash.startsWith("#/")) {
      const route = window.location.hash.slice(1).split("?", 1)[0] || "/progress";
      const params = new URLSearchParams({ range: next.range });
      if (next.categories.length) params.set("categories", next.categories.join(","));
      window.location.hash = `${route}?${params}`;
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("range", next.range);
    url.searchParams.delete("category");
    if (next.categories.length) url.searchParams.set("categories", next.categories.join(","));
    else url.searchParams.delete("categories");
    window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <main className="progress-shell mx-auto w-full max-w-[1500px] space-y-6">
      <header className="progress-header flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.055em] lg:text-[2.6rem]">Progress</h1>
        </div>
        <ProgressFilters filters={filters} categories={categories} onChange={updateFilters} />
      </header>

      <p className="sr-only">Showing {filterDescription}</p>
      <Summary data={data} />

      {!hasHistory ? (
        <EmptyProgress categoryNames={selectedNames} />
      ) : (
        <>
          <Heatmap data={data} range={filters.range} categories={visibleCategories} />
          <section className="progress-wide-grid">
            <WorkOverTime periods={periods} grouping={grouping} categories={visibleCategories} />
            <CategoryDistribution counts={data.categoryCounts} categories={visibleCategories} />
          </section>
          <section className="progress-wide-grid progress-wide-grid-even">
            <ProductiveDays periods={periods} grouping={grouping} />
            <WeekdayDistribution values={data.weekdayDistribution} />
          </section>
          <PlannedVsCompleted periods={periods} grouping={grouping} />
          <MonthlySummaries periods={monthly} categoryLabel={selectedNames.length ? selectedNames.join(", ") : "All pages"} />
        </>
      )}
    </main>
  );
}

function ProgressFilters({
  filters,
  categories,
  onChange,
}: {
  filters: { range: ProgressRangeKey; categories: string[] };
  categories: PlannerCategory[];
  onChange: (filters: { range: ProgressRangeKey; categories: string[] }) => void;
}) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryClosing, setCategoryClosing] = useState(false);
  const allSelected = filters.categories.length === 0;
  const filterLabel = allSelected ? "All pages" : filters.categories.length === 1 ? categories.find((item) => item.id === filters.categories[0])?.name ?? "1 page" : `${filters.categories.length} pages`;
  function toggle(id: string) {
    const next = filters.categories.includes(id) ? filters.categories.filter((value) => value !== id) : [...filters.categories, id];
    onChange({ ...filters, categories: next });
  }
  function closeCategoryPicker() {
    if (!categoryOpen || categoryClosing) return;
    setCategoryClosing(true);
    window.setTimeout(() => { setCategoryOpen(false); setCategoryClosing(false); }, 150);
  }
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (categoryOpen && !pickerRef.current?.contains(event.target as Node)) closeCategoryPicker();
    }
    function handleKeyDown(event: KeyboardEvent) { if (event.key === "Escape") closeCategoryPicker(); }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => { document.removeEventListener("pointerdown", handlePointerDown); document.removeEventListener("keydown", handleKeyDown); };
  });
  return (
    <div className="progress-filter-stack" aria-label="Progress filters">
      <nav className="progress-filter-group" aria-label="Time range">
        {progressRangeKeys.map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={filters.range === value}
            className={filters.range === value ? "progress-filter-active" : ""}
            onClick={() => onChange({ ...filters, range: value })}
          >
            {rangeLabels[value]}
          </button>
        ))}
      </nav>
      <div ref={pickerRef} className={`progress-category-picker ${categoryOpen ? "progress-category-picker-open" : ""}`}>
        <button type="button" className="progress-category-trigger" aria-expanded={categoryOpen} onClick={() => { if (categoryOpen) closeCategoryPicker(); else setCategoryOpen(true); }}><SlidersHorizontal size={14} /> <span>{filterLabel}</span></button>
        {(categoryOpen || categoryClosing) && <div className={`progress-category-menu ${categoryClosing ? "progress-category-menu-closing" : ""}`} role="group" aria-label="Choose pages">
          <button type="button" aria-pressed={allSelected} onClick={() => onChange({ ...filters, categories: [] })}><span className="progress-filter-check">{allSelected ? "✓" : ""}</span><strong>All pages</strong></button>
          {categories.map((category) => {
            const selected = filters.categories.includes(category.id);
            return <button type="button" key={category.id} aria-pressed={selected} onClick={() => toggle(category.id)}><span className="progress-filter-check">{selected ? "✓" : ""}</span><strong>{category.name}</strong></button>;
          })}
        </div>}
      </div>
    </div>
  );
}

function Summary({ data }: { data: ProgressData }) {
  const items = [
    { label: "Tasks completed", value: data.completedTasks, suffix: `${data.overdueCompletions} completed overdue`, icon: CheckCircle2 },
    { label: "Productive days", value: data.productiveDays, suffix: `${data.completionRate}% plan completion`, icon: CalendarCheck2 },
    { label: "Current streak", value: data.currentStreak, suffix: "productive days", icon: Flame },
    { label: "Best streak", value: data.bestStreak, suffix: "productive days", icon: Activity },
  ];
  return (
    <section className="progress-summary-grid" aria-label="Progress summary">
      {items.map(({ label, value, suffix, icon: Icon }) => (
        <article key={label} className="progress-stat glass-panel">
          <span className="progress-stat-icon"><Icon size={17} aria-hidden="true" /></span>
          <div>
            <p>{label}</p>
            <strong>{value.toLocaleString()}</strong>
            <small>{suffix}</small>
          </div>
        </article>
      ))}
    </section>
  );
}

function Panel({
  eyebrow,
  title,
  description,
  children,
  className = "",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`progress-panel glass-panel ${className}`}>
      <header className="progress-panel-heading">
        <div>
          <p className="dashboard-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

function Heatmap({ data, range, categories }: { data: ProgressData; range: ProgressRangeKey; categories: PlannerCategory[] }) {
  const days = buildHeatmap(data);
  if (range === "3m" || range === "6m") {
    return <CalendarActivity data={data} days={days} range={range} categories={categories} />;
  }
  const weeks = Math.ceil(days.length / 7);
  const rangeCopy = range === "all" ? "Latest 53 weeks of all-time history" : rangeLabels[range];
  return (
    <Panel eyebrow="Consistency" title="Activity" description={`${rangeCopy} · every task counts equally`}>
      <div className="progress-heatmap-scroller">
        <div
          className="progress-heatmap"
          style={{ "--heat-weeks": weeks } as CSSProperties}
          role="img"
          aria-label={`${data.completedTasks} tasks completed across ${data.productiveDays} productive days`}
        >
          {days.map((day) => {
            const level = activityLevel(day);
            return (
              <time
                key={day.date}
                dateTime={day.date}
                className={`progress-heat-cell progress-heat-${level} ${day.inRange ? "" : "progress-heat-outside"}`}
                aria-label={day.inRange ? activityDetail(day, categories) : undefined}
                title={day.inRange ? activityDetail(day, categories) : undefined}
              />
            );
          })}
        </div>
      </div>
      <ActivityLegend />
    </Panel>
  );
}

function CalendarActivity({ data, days, range, categories }: { data: ProgressData; days: HeatmapDay[]; range: "3m" | "6m"; categories: PlannerCategory[] }) {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const months = [...new Set(days.filter((day) => day.inRange).map((day) => day.date.slice(0, 7)))];
  return (
    <Panel eyebrow="Consistency" title="Activity" description={`${rangeLabels[range]} calendar · every task counts equally`}>
      <div className={`progress-calendar-months progress-calendar-${range}`} role="group" aria-label={`${data.completedTasks} tasks completed across ${data.productiveDays} productive days`}>
        {months.map((month) => {
          const monthStart = parseISO(`${month}-01`);
          const monthDays = eachDayOfInterval({ start: startOfMonth(monthStart), end: endOfMonth(monthStart) });
          return (
            <section className="progress-calendar-month" key={month} aria-label={format(monthStart, "MMMM yyyy")}>
              <h3>{format(monthStart, "MMMM yyyy")}</h3>
              <div className="progress-calendar-weekdays" aria-hidden="true">{["M", "T", "W", "T", "F", "S", "S"].map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>
              <div className="progress-calendar-days">
                {Array.from({ length: (monthStart.getDay() + 6) % 7 }, (_, index) => <i key={`blank-${index}`} />)}
                {monthDays.map((date) => {
                  const dateKey = format(date, "yyyy-MM-dd");
                  const day = byDate.get(dateKey);
                  const inRange = day?.inRange ?? false;
                  const level = day ? activityLevel(day) : 0;
                  return (
                    <time
                      key={dateKey}
                      dateTime={dateKey}
                      className={`progress-calendar-day progress-heat-${level} ${inRange ? "" : "progress-calendar-outside"}`}
                      aria-label={inRange && day ? activityDetail(day, categories) : undefined}
                      title={inRange && day ? activityDetail(day, categories) : undefined}
                    >
                      {format(date, "d")}
                    </time>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <ActivityLegend />
    </Panel>
  );
}

function ActivityLegend() {
  return <div className="progress-heat-legend" aria-hidden="true"><span>Less</span>{[0, 1, 2, 3, 4].map((level) => <i key={level} className={`progress-heat-${level}`} />)}<span>More</span></div>;
}

function activityLevel(day: HeatmapDay) {
  return day.completed === 0 ? 0 : Math.min(4, day.completed);
}

function activityDetail(day: HeatmapDay, categories: PlannerCategory[]) {
  const breakdown = categoryEntries(categories, day.categoryCounts).filter((category) => day.categoryCounts[category.id]).map((category) => `${category.name} ${day.categoryCounts[category.id]}`).join(", ");
  return `${format(parseISO(day.date), "MMMM d, yyyy")}: ${day.completed} ${day.completed === 1 ? "task" : "tasks"} completed${breakdown ? `. ${breakdown}.` : "."}`;
}

function WorkOverTime({ periods, grouping, categories }: { periods: ProgressPeriod[]; grouping: "day" | "week" | "month"; categories: PlannerCategory[] }) {
  const visible = periods.slice(-24);
  const maximum = Math.max(1, ...visible.map((period) => period.completed));
  const trimmed = periods.length > visible.length;
  return (
    <Panel
      eyebrow="Completed work"
      title="Tasks over time"
      description={`${trimmed ? "Latest 24 periods · " : ""}Grouped by ${grouping}`}
      className="progress-work-panel"
    >
      <div className="progress-chart-scroll">
        <div className="progress-stacked-chart" style={{ "--chart-columns": visible.length } as CSSProperties}>
          {visible.map((period, index) => (
            <div className="progress-stacked-column" key={period.key}>
              <div className="progress-stacked-track" title={`${period.label}: ${period.completed} completed`}>
                {categoryEntries(categories, period.categoryCounts).map((category) => {
                  const value = period.categoryCounts[category.id];
                  return value ? <span key={category.id} style={{ height: `${(value / maximum) * 100}%`, background: category.color }} /> : null;
                })}
              </div>
              <span className="progress-chart-value">{period.completed || ""}</span>
              <small>{showAxisLabel(index, visible.length) ? period.label : ""}</small>
            </div>
          ))}
        </div>
      </div>
      <CategoryLegend categories={categories} counts={periods.at(-1)?.categoryCounts ?? {}} />
    </Panel>
  );
}

function CategoryDistribution({ counts, categories }: { counts: ProgressData["categoryCounts"]; categories: PlannerCategory[] }) {
  const entries = categoryEntries(categories, counts);
  const total = entries.reduce((sum, category) => sum + (counts[category.id] ?? 0), 0);
  let cursor = 0;
  const stops = entries.map((category) => {
    const start = cursor;
    cursor += total ? ((counts[category.id] ?? 0) / total) * 100 : 0;
    return `${category.color} ${start}% ${cursor}%`;
  });
  const style = { "--progress-donut": total ? `conic-gradient(${stops.join(",")})` : "var(--muted)" } as CSSProperties;
  return (
    <Panel eyebrow="Distribution" title="Where the work went" description="Completed tasks by category">
      <div className="progress-donut-layout">
        <div className="progress-donut" style={style} role="img" aria-label={`${total} completed tasks by category`}>
          <span><strong>{total}</strong><small>completed</small></span>
        </div>
        <div className="progress-category-list">
          {entries.map((category) => {
            const value = counts[category.id] ?? 0;
            const percentage = total ? Math.round((value / total) * 100) : 0;
            return <div key={category.id}><span><i style={{ background: category.color }} />{category.name}</span><strong>{value} <small>{percentage}%</small></strong></div>;
          })}
        </div>
      </div>
    </Panel>
  );
}

function ProductiveDays({ periods, grouping }: { periods: ProgressPeriod[]; grouping: "day" | "week" | "month" }) {
  const visible = periods.slice(-12);
  const maximum = grouping === "week" ? 7 : Math.max(1, ...visible.map((period) => period.productiveDays));
  return (
    <Panel eyebrow="Consistency" title="Productive days" description={`Recent ${grouping === "week" ? "weeks" : "months"}`}>
      <div className="progress-horizontal-list">
        {visible.map((period) => (
          <div className="progress-horizontal-row" key={period.key}>
            <span>{period.label}</span>
            <div><i style={{ width: `${(period.productiveDays / maximum) * 100}%` }} /></div>
            <strong>{period.productiveDays}</strong>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function WeekdayDistribution({ values }: { values: ProgressData["weekdayDistribution"] }) {
  const entries = Object.entries(values) as [keyof typeof values, number][];
  const maximum = Math.max(1, ...entries.map(([, value]) => value));
  return (
    <Panel eyebrow="Rhythm" title="Strongest weekdays" description="Tasks completed by local weekday">
      <div className="progress-horizontal-list">
        {entries.map(([weekday, value]) => (
          <div className="progress-horizontal-row" key={weekday}>
            <span>{weekday.slice(0, 3)}</span>
            <div><i style={{ width: `${(value / maximum) * 100}%` }} /></div>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PlannedVsCompleted({ periods, grouping }: { periods: ProgressPeriod[]; grouping: "day" | "week" | "month" }) {
  const visible = periods.slice(-12);
  const maximum = Math.max(1, ...visible.map((period) => period.planned));
  return (
    <Panel eyebrow="Planning accuracy" title="Planned vs completed" description={`Cohort completion by ${grouping} · recent ${visible.length} periods`}>
      <div className="progress-plan-table" role="table" aria-label="Historical planned and completed work">
        <div className="progress-plan-header" role="row"><span role="columnheader">Period</span><span role="columnheader">Work</span><span role="columnheader">Rate</span></div>
        {visible.map((period) => (
          <div className="progress-plan-row" role="row" key={period.key}>
            <span role="cell">{period.label}</span>
            <div role="cell" className="progress-plan-bars" aria-label={`${period.plannedCompleted} of ${period.planned} planned tasks completed`}>
              <i className="progress-plan-total" style={{ width: `${(period.planned / maximum) * 100}%` }} />
              <i className="progress-plan-done" style={{ width: `${(period.plannedCompleted / maximum) * 100}%` }} />
              <small>{period.plannedCompleted} / {period.planned}</small>
            </div>
            <strong role="cell">{period.completionRate}%</strong>
          </div>
        ))}
      </div>
      <div className="progress-plan-legend" aria-hidden="true"><span><i />Planned</span><span><i />Completed</span></div>
    </Panel>
  );
}

function MonthlySummaries({ periods, categoryLabel }: { periods: ProgressPeriod[]; categoryLabel: string }) {
  const visible = periods.slice(-12).reverse();
  return (
    <Panel eyebrow="Monthly history" title="Monthly summaries" description={`${categoryLabel} · latest ${visible.length} months`}>
      <div className="progress-month-table-wrap">
        <table className="progress-month-table">
          <thead><tr><th>Month</th><th>Completed</th><th>Productive days</th><th>Planned</th><th>Completion rate</th></tr></thead>
          <tbody>
            {visible.map((period) => <tr key={period.key}><th data-label="Month">{period.label}</th><td data-label="Completed">{period.completed}</td><td data-label="Productive days">{period.productiveDays}</td><td data-label="Planned">{period.planned}</td><td data-label="Completion rate">{period.completionRate}%</td></tr>)}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function CategoryLegend({ categories, counts }: { categories: PlannerCategory[]; counts: Record<string, number> }) {
  return <div className="progress-category-legend" aria-label="Task categories">{categoryEntries(categories, counts).map((category) => <span key={category.id}><i style={{ background: category.color }} />{category.name}</span>)}</div>;
}

function EmptyProgress({ categoryNames }: { categoryNames: string[] }) {
  return (
    <section className="progress-empty glass-panel">
      <span><CircleGauge size={22} aria-hidden="true" /></span>
      <div>
        <h2>No {categoryNames.length ? categoryNames.join(" + ").toLowerCase() + " history" : "progress history"} in this range yet.</h2>
        <p>Plan tasks, complete them, and this page will turn that real history into a clear record of your progress.</p>
      </div>
      <CalendarRange size={20} aria-hidden="true" />
    </section>
  );
}

function showAxisLabel(index: number, length: number) {
  const interval = length > 18 ? 4 : length > 10 ? 2 : 1;
  return index === 0 || index === length - 1 || index % interval === 0;
}
