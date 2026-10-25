import { addDays, differenceInCalendarDays } from "date-fns";
import { z } from "zod";

import { dateKey, localDate } from "@/lib/dates/timezone";
import type { ActivityCursor } from "@/lib/activity/types";

const dateOnlySchema = z.iso.date();

export type CalendarWindow = { start: string; end: string };

export function parseCalendarWindow(url: string): CalendarWindow {
  const params = new URL(url).searchParams;
  const parsed = z.object({
    start: dateOnlySchema,
    end: dateOnlySchema,
  }).strict().safeParse({ start: params.get("start"), end: params.get("end") });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");
  const days = differenceInCalendarDays(localDate(parsed.data.end), localDate(parsed.data.start));
  if (days < 0 || days > 92) throw new Error("VALIDATION_ERROR");
  return parsed.data;
}

export function calendarWindowEndExclusive(window: CalendarWindow) {
  return dateKey(addDays(localDate(window.end), 1));
}

export function parseTaskQuery(url: string) {
  const params = new URL(url).searchParams;
  const parsed = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    before: z.iso.datetime({ offset: true }).optional(),
  }).strict().safeParse({
    limit: params.get("limit") ?? undefined,
    before: params.get("before") ?? undefined,
  });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");
  return parsed.data;
}

export function parseActivityCursor(url: string): ActivityCursor | null {
  const params = new URL(url).searchParams;
  const occurredAt = params.get("cursorOccurredAt");
  const id = params.get("cursorId");
  if (!occurredAt && !id) return null;
  const parsed = z.object({
    occurredAt: z.iso.datetime({ offset: true }),
    id: z.uuid(),
  }).strict().safeParse({ occurredAt, id });
  if (!parsed.success) throw new Error("VALIDATION_ERROR");
  return parsed.data;
}
