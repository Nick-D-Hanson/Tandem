import { addDays, differenceInCalendarDays } from "date-fns";

import { dateKey, localDate, localDateTimeToUtc, utcToLocalParts } from "@/lib/dates/timezone";

export function moveTaskToLocalDate(input: {
  dueAt: Date | null;
  dueIsAllDay: boolean;
  targetDate: string;
  timezone: string;
}) {
  const current = input.dueAt ? utcToLocalParts(input.dueAt, input.timezone) : null;
  return localDateTimeToUtc({
    date: input.targetDate,
    time: current && !input.dueIsAllDay ? current.time : null,
  }, input.timezone);
}

export function moveEventToLocalDate(input: {
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  recurrence: string | null;
  targetDate: string;
  timezone: string;
}) {
  if (input.recurrence) throw new Error("CONFLICT");
  const start = utcToLocalParts(input.startAt, input.timezone);
  const end = utcToLocalParts(input.endAt, input.timezone);

  if (input.allDay) {
    const inclusiveEnd = addDays(localDate(end.date), -1);
    const inclusiveSpan = differenceInCalendarDays(inclusiveEnd, localDate(start.date));
    return {
      startAt: localDateTimeToUtc({ date: input.targetDate }, input.timezone),
      endAt: localDateTimeToUtc({
        date: dateKey(addDays(localDate(input.targetDate), inclusiveSpan + 1)),
      }, input.timezone),
    };
  }

  const delta = differenceInCalendarDays(localDate(input.targetDate), localDate(start.date));
  return {
    startAt: localDateTimeToUtc({ date: input.targetDate, time: start.time }, input.timezone),
    endAt: localDateTimeToUtc({
      date: dateKey(addDays(localDate(end.date), delta)),
      time: end.time,
    }, input.timezone),
  };
}
