import { format, isValid, parseISO, startOfWeek } from "date-fns";

export function currentWeekStart() {
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function normalizeWeekStart(value?: string | string[]) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (
    candidate &&
    /^\d{4}-\d{2}-\d{2}$/.test(candidate) &&
    isValid(parseISO(candidate))
  ) {
    return format(
      startOfWeek(parseISO(candidate), { weekStartsOn: 1 }),
      "yyyy-MM-dd",
    );
  }
  return currentWeekStart();
}
