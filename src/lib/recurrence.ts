import { addDays, differenceInCalendarDays, differenceInCalendarMonths } from "date-fns";

import { dateKey, localDate } from "@/lib/dates/timezone";

export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays?: number[];
  until?: string;
};

export function recurrenceIntervalDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 2);
}

export function normalizeRecurrenceInterval(value: string | number | null | undefined) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) ? Math.max(1, Math.min(99, parsed)) : 1;
}

const frequencies = new Set<RecurrenceFrequency>(["daily", "weekly", "monthly", "yearly"]);

export function parseRecurrence(value: string | null | undefined): RecurrenceRule | null {
  if (!value) return null;
  if (frequencies.has(value as RecurrenceFrequency)) return { frequency: value as RecurrenceFrequency, interval: 1 };
  try {
    const parsed = JSON.parse(value) as Partial<RecurrenceRule> & { v?: number };
    if (!parsed.frequency || !frequencies.has(parsed.frequency) || !Number.isInteger(parsed.interval) || parsed.interval! < 1 || parsed.interval! > 99) return null;
    const weekdays = parsed.weekdays?.filter((day, index, values) => Number.isInteger(day) && day >= 0 && day <= 6 && values.indexOf(day) === index);
    return {
      frequency: parsed.frequency,
      interval: parsed.interval!,
      ...(weekdays?.length ? { weekdays } : {}),
      ...(parsed.until && /^\d{4}-\d{2}-\d{2}$/.test(parsed.until) ? { until: parsed.until } : {}),
    };
  } catch {
    return null;
  }
}

export function serializeRecurrence(rule: RecurrenceRule | null | undefined) {
  if (!rule) return null;
  const weekdays = rule.weekdays?.filter((day, index, values) => Number.isInteger(day) && day >= 0 && day <= 6 && values.indexOf(day) === index).sort();
  if (rule.interval === 1 && !weekdays?.length && !rule.until) return rule.frequency;
  return JSON.stringify({ v: 1, frequency: rule.frequency, interval: rule.interval, ...(weekdays?.length ? { weekdays } : {}), ...(rule.until ? { until: rule.until } : {}) });
}

export function recurrenceMatchesDate(base: string, target: string, rule: RecurrenceRule | null) {
  if (target < base || (rule?.until && target > rule.until)) return false;
  if (!rule) return target === base;
  const baseDate = localDate(base);
  const targetDate = localDate(target);
  const dayDifference = differenceInCalendarDays(targetDate, baseDate);

  if (rule.frequency === "daily") return dayDifference % rule.interval === 0;
  if (rule.frequency === "weekly") {
    const weekdays = rule.weekdays?.length ? rule.weekdays : [baseDate.getDay()];
    const baseWeekStart = addDays(baseDate, -baseDate.getDay());
    const targetWeekStart = addDays(targetDate, -targetDate.getDay());
    const weekDifference = differenceInCalendarDays(targetWeekStart, baseWeekStart) / 7;
    return weekDifference % rule.interval === 0 && weekdays.includes(targetDate.getDay());
  }
  if (rule.frequency === "monthly") {
    return differenceInCalendarMonths(targetDate, baseDate) % rule.interval === 0 && targetDate.getDate() === baseDate.getDate();
  }
  return (targetDate.getFullYear() - baseDate.getFullYear()) % rule.interval === 0
    && targetDate.getMonth() === baseDate.getMonth()
    && targetDate.getDate() === baseDate.getDate();
}

export function nextRecurrenceDate(base: string, rule: RecurrenceRule) {
  const start = localDate(base);
  for (let offset = 1; offset <= 37000; offset += 1) {
    const candidate = dateKey(addDays(start, offset));
    if (rule.until && candidate > rule.until) return null;
    if (recurrenceMatchesDate(base, candidate, rule)) return candidate;
  }
  return null;
}

export function recurrenceLabel(rule: RecurrenceRule | null) {
  if (!rule) return "Does not repeat";
  const unit = rule.frequency.replace("daily", "day").replace("weekly", "week").replace("monthly", "month").replace("yearly", "year");
  if (rule.interval === 1) return `Every ${unit}`;
  return `Every ${rule.interval} ${unit}s`;
}
