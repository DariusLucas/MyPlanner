"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  Activity,
  CalendarCheck2,
  CalendarRange,
  CheckCircle2,
  CircleGauge,
  Flame,
} from "lucide-react";
import { eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { calculateProgress, type ProgressCategory, type ProgressData, type ProgressTask } from "@/src/lib/progress";
import {
  buildHeatmap,
  buildProgressPeriods,
  normalizeProgressCategory,
  normalizeProgressRange,
  progressGrouping,
  progressRangeKeys,
  progressRangeStart,
  type ProgressCategoryFilter,
  type HeatmapDay,
  type ProgressPeriod,
  type ProgressRangeKey,
} from "@/src/lib/progress-visuals";

const rangeLabels: Record<ProgressRangeKey, string> = {
  "3m": "3 months",
  "6m": "6 months",
  "1y": "1 year",
  all: "All time",
};
const categoryLabels: Record<ProgressCategoryFilter, string> = {
  all: "All work",
  career: "Career",
  content: "Content",
  personal: "Personal",
};
const categoryKeys: ProgressCategory[] = ["career", "content", "personal"];

type ProgressViewProps = {
  range: ProgressRangeKey;
  category: ProgressCategoryFilter;
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
  const { range, category } = props;
  const taskHistory = "taskHistory" in props ? props.taskHistory : undefined;
  const today = "today" in props ? props.today : undefined;
  const timeZone = "timeZone" in props ? props.timeZone : undefined;
  const suppliedData = "data" in props ? props.data : undefined;
  const [filters, setFilters] = useState({ range, category });

  useEffect(() => {
    setFilters({ range, category });
  }, [range, category]);

  useEffect(() => {
    function restoreFiltersFromUrl() {
      const params = browserFilterParams();
      setFilters({
        range: normalizeProgressRange(params.get("range") ?? undefined),
        category: normalizeProgressCategory(params.get("category") ?? undefined),
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
          category: filters.category === "all" ? undefined : filters.category,
        })
      : suppliedData!,
    [filters, suppliedData, taskHistory, timeZone, today],
  );
  const grouping = progressGrouping(filters.range);
  const periods = buildProgressPeriods(data, grouping);
  const monthly = buildProgressPeriods(data, "month");
  const hasHistory = data.tasksPlanned > 0 || data.completedTasks > 0;
  const filterDescription = `${rangeLabels[filters.range]} · ${categoryLabels[filters.category]}`;

  function updateFilters(next: typeof filters) {
    if (next.range === filters.range && next.category === filters.category) return;
    setFilters(next);
    if (window.location.hash.startsWith("#/")) {
      const route = window.location.hash.slice(1).split("?", 1)[0] || "/progress";
      const params = new URLSearchParams({ range: next.range, category: next.category });
      window.location.hash = `${route}?${params}`;
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("range", next.range);
    url.searchParams.set("category", next.category);
    window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <main className="progress-shell mx-auto w-full max-w-[1500px] space-y-6">
      <header className="progress-header flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="dashboard-eyebrow">See progress</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.055em]">Your work, over time</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            A history of planned work, completed tasks, and the days you kept showing up.
          </p>
        </div>
        <ProgressFilters filters={filters} onChange={updateFilters} />
      </header>

      <p className="sr-only">Showing {filterDescription}</p>
      <Summary data={data} />

      {!hasHistory ? (
        <EmptyProgress category={filters.category} />
      ) : (
        <>
          <Heatmap data={data} range={filters.range} />
          <section className="progress-wide-grid">
            <WorkOverTime periods={periods} grouping={grouping} />
            <CategoryDistribution counts={data.categoryCounts} />
          </section>
          <section className="progress-wide-grid progress-wide-grid-even">
            <ProductiveDays periods={periods} grouping={grouping} />
            <WeekdayDistribution values={data.weekdayDistribution} />
          </section>
          <PlannedVsCompleted periods={periods} grouping={grouping} />
          <MonthlySummaries periods={monthly} category={filters.category} />
        </>
      )}
    </main>
  );
}

function ProgressFilters({
  filters,
  onChange,
}: {
  filters: { range: ProgressRangeKey; category: ProgressCategoryFilter };
  onChange: (filters: { range: ProgressRangeKey; category: ProgressCategoryFilter }) => void;
}) {
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
      <nav className="progress-filter-group" aria-label="Category">
        {(Object.keys(categoryLabels) as ProgressCategoryFilter[]).map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={filters.category === value}
            className={filters.category === value ? "progress-filter-active" : ""}
            onClick={() => onChange({ ...filters, category: value })}
          >
            {categoryLabels[value]}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Summary({ data }: { data: ProgressData }) {
  const items = [
    { label: "Current streak", value: data.currentStreak, suffix: "productive days", icon: Flame },
    { label: "Best streak", value: data.bestStreak, suffix: "productive days", icon: Activity },
    { label: "Tasks completed", value: data.completedTasks, suffix: `${data.overdueCompletions} completed overdue`, icon: CheckCircle2 },
    { label: "Productive days", value: data.productiveDays, suffix: `${data.completionRate}% plan completion`, icon: CalendarCheck2 },
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

function Heatmap({ data, range }: { data: ProgressData; range: ProgressRangeKey }) {
  const days = buildHeatmap(data);
  if (range === "3m" || range === "6m") {
    return <CalendarActivity data={data} days={days} range={range} />;
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
            const detail = activityDetail(day);
            return (
              <time
                key={day.date}
                dateTime={day.date}
                className={`progress-heat-cell progress-heat-${level} ${day.inRange ? "" : "progress-heat-outside"}`}
                aria-label={day.inRange ? detail : undefined}
                title={day.inRange ? detail : undefined}
              />
            );
          })}
        </div>
      </div>
      <ActivityLegend />
    </Panel>
  );
}

function CalendarActivity({ data, days, range }: { data: ProgressData; days: HeatmapDay[]; range: "3m" | "6m" }) {
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
                      aria-label={inRange && day ? activityDetail(day) : undefined}
                      title={inRange && day ? activityDetail(day) : undefined}
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

function activityDetail(day: HeatmapDay) {
  return `${format(parseISO(day.date), "MMMM d, yyyy")}: ${day.completed} ${day.completed === 1 ? "task" : "tasks"} completed. Career ${day.categoryCounts.career}, Content ${day.categoryCounts.content}, Personal ${day.categoryCounts.personal}.`;
}

function WorkOverTime({ periods, grouping }: { periods: ProgressPeriod[]; grouping: "day" | "week" | "month" }) {
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
                {categoryKeys.map((category) => {
                  const value = period.categoryCounts[category];
                  return value ? <span key={category} className={`progress-series-${category}`} style={{ height: `${(value / maximum) * 100}%` }} /> : null;
                })}
              </div>
              <span className="progress-chart-value">{period.completed || ""}</span>
              <small>{showAxisLabel(index, visible.length) ? period.label : ""}</small>
            </div>
          ))}
        </div>
      </div>
      <CategoryLegend />
    </Panel>
  );
}

function CategoryDistribution({ counts }: { counts: ProgressData["categoryCounts"] }) {
  const total = categoryKeys.reduce((sum, category) => sum + counts[category], 0);
  let cursor = 0;
  const stops = categoryKeys.map((category) => {
    const start = cursor;
    cursor += total ? (counts[category] / total) * 100 : 0;
    return `var(--progress-${category}) ${start}% ${cursor}%`;
  });
  const style = { "--progress-donut": total ? `conic-gradient(${stops.join(",")})` : "var(--muted)" } as CSSProperties;
  return (
    <Panel eyebrow="Distribution" title="Where the work went" description="Completed tasks by category">
      <div className="progress-donut-layout">
        <div className="progress-donut" style={style} role="img" aria-label={`Career ${counts.career}, Content ${counts.content}, Personal ${counts.personal}`}>
          <span><strong>{total}</strong><small>completed</small></span>
        </div>
        <div className="progress-category-list">
          {categoryKeys.map((category) => {
            const percentage = total ? Math.round((counts[category] / total) * 100) : 0;
            return <div key={category}><span><i className={`progress-series-${category}`} />{categoryLabels[category]}</span><strong>{counts[category]} <small>{percentage}%</small></strong></div>;
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

function MonthlySummaries({ periods, category }: { periods: ProgressPeriod[]; category: ProgressCategoryFilter }) {
  const visible = periods.slice(-12).reverse();
  return (
    <Panel eyebrow="Monthly history" title="Monthly summaries" description={`${categoryLabels[category]} · latest ${visible.length} months`}>
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

function CategoryLegend() {
  return <div className="progress-category-legend" aria-label="Task categories">{categoryKeys.map((category) => <span key={category}><i className={`progress-series-${category}`} />{categoryLabels[category]}</span>)}</div>;
}

function EmptyProgress({ category }: { category: ProgressCategoryFilter }) {
  return (
    <section className="progress-empty glass-panel">
      <span><CircleGauge size={22} aria-hidden="true" /></span>
      <div>
        <h2>No {category === "all" ? "progress history" : categoryLabels[category].toLowerCase() + " history"} in this range yet.</h2>
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
