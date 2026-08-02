import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

export type LocalDateTimeInput = { date: string; time?: string | null };

export function localDateTimeToUtc({ date, time }: LocalDateTimeInput, timezone: string) {
  const localTime = time?.trim() || "00:00";
  return fromZonedTime(`${date}T${localTime}:00`, timezone);
}

export function utcToLocalParts(value: Date | string, timezone: string) {
  const instant = typeof value === "string" ? new Date(value) : value;
  return {
    date: formatInTimeZone(instant, timezone, "yyyy-MM-dd"),
    time: formatInTimeZone(instant, timezone, "HH:mm"),
  };
}

export function formatWorkspaceDate(value: Date | string, timezone: string, pattern = "EEE, MMM d") {
  return formatInTimeZone(value, timezone, pattern);
}

export function monthCalendarRange(anchor: Date) {
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 0 });
  const days: Date[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) days.push(cursor);
  return days;
}

export function weekCalendarRange(anchor: Date) {
  const start = startOfWeek(anchor, { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function safeBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago";
  } catch {
    return "America/Chicago";
  }
}

export function localDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

export function dateKey(value: Date) {
  return format(value, "yyyy-MM-dd");
}

export function zonedNow(timezone: string) {
  return toZonedTime(new Date(), timezone);
}

export function workspaceDateKey(timezone: string, instant: Date = new Date()) {
  return formatInTimeZone(instant, timezone, "yyyy-MM-dd");
}

export function agendaDateWindow(timezone: string, instant: Date = new Date()) {
  const today = localDate(workspaceDateKey(timezone, instant));
  return {
    yesterday: dateKey(addDays(today, -1)),
    today: dateKey(today),
    future: Array.from({ length: 3 }, (_, index) => dateKey(addDays(today, index))),
    editable: Array.from({ length: 4 }, (_, index) => dateKey(addDays(today, index - 1))),
  };
}
