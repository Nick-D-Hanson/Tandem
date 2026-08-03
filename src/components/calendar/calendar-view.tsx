"use client";

import { addDays, addMonths, differenceInCalendarDays, format, isSameMonth, isToday, subDays } from "date-fns";
import { CalendarCheck2, CalendarDays, Clock3, MapPin, Repeat2 } from "lucide-react";

import { ItemHoverDetails } from "@/components/items/item-hover-details";
import { cn } from "@/lib/utils";
import { dateKey, localDate, monthCalendarRange, utcToLocalParts, weekCalendarRange, zonedNow } from "@/lib/dates/timezone";
import { recurrenceLabel, recurrenceMatchesDate } from "@/lib/recurrence";
import type { EventView, ListView, TaskView } from "@/lib/types";

export type CalendarMode = "today" | "month" | "week" | "quarter" | "events" | "agenda";
export type CalendarSelection = { type: "event" | "task"; id?: string; date?: string; time?: string };

type CalendarItem = {
  id: string;
  type: "event" | "task";
  title: string;
  date: string;
  time: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  allDay: boolean;
  completed: boolean;
  location?: string | null;
  description?: string | null;
  color: string;
  createdAt: string;
};

export function CalendarView({ mode, anchor, timezone, tasks, events, lists, onSelect }: {
  mode: CalendarMode;
  anchor: Date;
  timezone: string;
  tasks: TaskView[];
  events: EventView[];
  lists: ListView[];
  onSelect: (selection: CalendarSelection) => void;
}) {
  if (mode === "today") return <TodayView anchor={anchor} timezone={timezone} tasks={tasks} events={events} lists={lists} onSelect={onSelect} />;
  if (mode === "week") return <WeekView anchor={anchor} timezone={timezone} tasks={tasks} events={events} lists={lists} onSelect={onSelect} />;
  if (mode === "quarter") return <ThreeMonthView anchor={anchor} timezone={timezone} tasks={tasks} events={events} lists={lists} onSelect={onSelect} />;
  if (mode === "events") return <FutureEventsView timezone={timezone} events={events} lists={lists} onSelect={onSelect} />;
  if (mode === "agenda") return <AgendaView anchor={anchor} timezone={timezone} tasks={tasks} events={events} lists={lists} onSelect={onSelect} />;
  return <MonthView anchor={anchor} timezone={timezone} tasks={tasks} events={events} lists={lists} onSelect={onSelect} />;
}

function TodayView({ anchor, timezone, tasks, events, lists, onSelect }: Omit<React.ComponentProps<typeof CalendarView>, "mode">) {
  const key = dateKey(anchor);
  const items = itemsForDate(key, timezone, tasks, events, lists);
  return (
    <div className="min-h-0 flex-1 overflow-auto" data-testid="today-view">
      <div className="mx-auto grid max-w-4xl gap-4 p-4 pb-24">
        <div><h2 className="text-lg font-semibold">{isToday(anchor) ? "Today" : format(anchor, "EEEE")}</h2><p className="text-sm text-muted-foreground">{format(anchor, "MMMM d, yyyy")}</p></div>
        <div className="min-w-0 overflow-hidden rounded-xl border bg-card">
          {items.length === 0 && <button type="button" onClick={() => onSelect({ type: "event", date: key })} className="min-h-20 w-full px-4 text-left text-sm text-muted-foreground hover:bg-secondary/60">No items scheduled — add one</button>}
          {items.map((item) => <ItemHoverDetails key={`${item.type}-${item.id}`} title={item.title} description={item.description} meta={item.location}><button type="button" onClick={() => onSelect({ type: item.type, id: item.id })} className="flex min-h-16 w-full min-w-0 items-center gap-3 overflow-hidden border-b px-4 text-left last:border-b-0 hover:bg-secondary/60"><span className="w-16 shrink-0 text-xs text-muted-foreground">{item.type === "task" ? (item.completed ? "Done" : "Due") : item.time ? formatTime(item.time) : "All day"}</span><span className={cn("size-2.5 shrink-0", item.type === "event" ? "rounded-sm" : "rounded-full")} style={{ backgroundColor: item.color }} /><span className="min-w-0"><strong className={cn("block truncate", item.completed && "line-through opacity-55")}>{item.title}</strong><span className="flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground">{item.type === "task" ? <><Clock3 className="size-3 shrink-0" />Task</> : item.location ? <><MapPin className="size-3 shrink-0" /><span className="truncate">{item.location}</span></> : "Event"}</span></span></button></ItemHoverDetails>)}
        </div>
      </div>
    </div>
  );
}

function occurrenceStartOnDate(event: EventView, targetDate: string, timezone: string) {
  const base = utcToLocalParts(event.startAt, timezone).date;
  const storedEnd = utcToLocalParts(event.endAt, timezone).date;
  const inclusiveEnd = event.allDay ? dateKey(addDays(localDate(storedEnd), -1)) : storedEnd;
  const duration = Math.max(0, differenceInCalendarDays(localDate(inclusiveEnd), localDate(base)));
  for (let offset = 0; offset <= duration; offset += 1) {
    const possibleStart = dateKey(addDays(localDate(targetDate), -offset));
    if (recurrenceMatchesDate(base, possibleStart, event.recurrence)) return possibleStart;
  }
  return null;
}

function itemsForDate(date: string, timezone: string, tasks: TaskView[], events: EventView[], lists: ListView[]): CalendarItem[] {
  const eventItems = events.flatMap((event) => {
    const occurrenceStart = occurrenceStartOnDate(event, date, timezone);
    if (!occurrenceStart) return [];
    const parts = utcToLocalParts(event.startAt, timezone);
    const endParts = utcToLocalParts(event.endAt, timezone);
    const isTimedStart = !event.allDay && occurrenceStart === date;
    const startMinutes = timeToMinutes(parts.time);
    const eventDurationMinutes = Math.max(15, (new Date(event.endAt).getTime() - new Date(event.startAt).getTime()) / 60_000);
    return [{ id: event.id, type: "event" as const, title: event.title, date, time: isTimedStart ? parts.time : null, endTime: isTimedStart ? endParts.time : null, durationMinutes: isTimedStart ? Math.min(eventDurationMinutes, 1440 - startMinutes) : null, allDay: !isTimedStart, completed: false, location: event.location, description: event.description, color: calendarColor(event.color), createdAt: event.createdAt }];
  });
  const taskItems = tasks.filter((task) => task.dueAt && utcToLocalParts(task.dueAt, timezone).date === date).map((task) => {
    const parts = utcToLocalParts(task.dueAt!, timezone);
    return { id: task.id, type: "task" as const, title: task.title, date, time: task.dueIsAllDay ? null : parts.time, endTime: null, durationMinutes: null, allDay: task.dueIsAllDay, completed: Boolean(task.completedAt), description: task.notes, color: lists.find((list) => list.id === task.listId)?.color ?? "#64748b", createdAt: task.createdAt };
  });
  return [...eventItems, ...taskItems].sort(compareCalendarItems);
}

export function compareCalendarItems(a: Pick<CalendarItem, "time" | "createdAt">, b: Pick<CalendarItem, "time" | "createdAt">) {
  if (a.time && b.time) return a.time.localeCompare(b.time) || b.createdAt.localeCompare(a.createdAt);
  if (a.time) return 1;
  if (b.time) return -1;
  return b.createdAt.localeCompare(a.createdAt);
}

function MonthView({ anchor, timezone, tasks, events, lists, onSelect }: Omit<React.ComponentProps<typeof CalendarView>, "mode">) {
  const days = monthCalendarRange(anchor);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-testid="month-view">
      <div className="grid grid-cols-7 border-b bg-card">
        {Array.from({ length: 7 }, (_, index) => <div key={index} className="px-2.5 py-2 text-[11px] font-bold uppercase tracking-[.06em] text-muted-foreground max-[820px]:px-1 max-[820px]:text-center max-[820px]:text-[10px]">{format(addDays(new Date(2026, 0, 4), index), "EEE")}</div>)}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-px overflow-auto bg-border">
        {days.map((day) => {
          const key = dateKey(day);
          const items = itemsForDate(key, timezone, tasks, events, lists);
          return (
            <div key={key} role="button" tabIndex={0} aria-label={`Add event on ${format(day, "EEEE, MMMM d")}`} onClick={() => onSelect({ type: "event", date: key })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect({ type: "event", date: key }); }} className={cn("min-h-[88px] min-w-0 cursor-pointer overflow-hidden bg-card p-1.5 hover:bg-secondary/50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring max-[820px]:min-h-[74px] max-[820px]:p-1", !isSameMonth(day, anchor) && "bg-secondary/35 text-muted-foreground")}>
              <div className={cn("mb-1 grid size-6 place-items-center rounded-full text-xs font-semibold max-[820px]:mx-auto", isToday(day) && "bg-primary text-primary-foreground")}>{format(day, "d")}</div>
              <div className="grid gap-0.5">
                {items.slice(0, 3).map((item) => <CalendarPill key={`${item.type}-${item.id}`} item={item} onSelect={onSelect} />)}
                {items.length > 3 && <span className="px-1 text-[11px] text-muted-foreground">+{items.length - 3} more</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarPill({ item, onSelect }: { item: CalendarItem; onSelect: (selection: CalendarSelection) => void }) {
  return (
    <ItemHoverDetails title={item.title} description={item.description} meta={item.location}><button type="button" onClick={(event) => { event.stopPropagation(); onSelect({ type: item.type, id: item.id }); }} className={cn("flex min-h-6 min-w-0 items-center gap-1 overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-[11px] font-semibold text-foreground hover:brightness-95 max-[820px]:min-h-5 max-[820px]:justify-center max-[820px]:px-1 max-[820px]:text-[10px]", item.completed && "opacity-50 line-through")} style={categoryStyle(item.color)}>
      <span className={cn("size-1.5 shrink-0 bg-current max-[820px]:hidden", item.type === "event" ? "rounded-sm" : "rounded-full")} style={{ backgroundColor: item.color }} />
      <span className="truncate">{item.time ? `${formatTime(item.time)} ` : ""}{item.title}</span>
    </button></ItemHoverDetails>
  );
}

function WeekView({ anchor, timezone, tasks, events, lists, onSelect }: Omit<React.ComponentProps<typeof CalendarView>, "mode">) {
  const days = weekCalendarRange(anchor);
  const dayKeys = days.map(dateKey);
  const itemsByDay = new Map(dayKeys.map((date) => [date, itemsForDate(date, timezone, tasks, events, lists)]));
  const allDayItems = dayKeys.map((date) => itemsByDay.get(date)?.filter((item) => item.allDay) ?? []);
  const timedItems = [...itemsByDay.values()].flat().filter((item) => item.time);
  const firstHour = Math.min(7, ...timedItems.map((item) => Math.floor(timeToMinutes(item.time!) / 60)));
  const lastHour = Math.max(20, ...timedItems.map((item) => Math.ceil((timeToMinutes(item.time!) + (item.durationMinutes ?? 30)) / 60) - 1));
  const visibleHours = Array.from({ length: lastHour - firstHour + 1 }, (_, index) => firstHour + index);
  return (
    <div className="min-h-0 flex-1 overflow-auto" data-testid="week-view">
      <div className="grid min-w-[560px] grid-cols-[56px_repeat(7,minmax(0,1fr))]">
        <div className="sticky top-0 z-20 border-b border-r bg-card" />
        {days.map((day) => <div key={dateKey(day)} className="sticky top-0 z-20 border-b border-r bg-card p-2 text-center"><span className="block text-[11px] font-semibold uppercase text-muted-foreground">{format(day, "EEE")}</span><strong className={cn("mx-auto mt-0.5 grid size-7 place-items-center rounded-full", isToday(day) && "bg-primary text-primary-foreground")}>{format(day, "d")}</strong></div>)}
        <div className="border-b border-r px-2 py-2 text-right text-[10px] font-semibold uppercase text-muted-foreground">All day</div>
        {allDayItems.map((items, dayIndex) => <div key={dayKeys[dayIndex]} className="min-h-20 min-w-0 overflow-hidden border-b border-r p-1.5"><div className="grid min-w-0 gap-1.5">{items.map((item) => <WeekAllDayItem key={`${item.type}-${item.id}`} item={item} onSelect={onSelect} />)}</div></div>)}
        {visibleHours.map((hour) => (
          <div className="contents" key={hour}>
            <div className="h-14 border-b border-r px-2 pt-1 text-right text-[11px] text-muted-foreground">{formatTime(`${String(hour).padStart(2, "0")}:00`)}</div>
            {dayKeys.map((date) => {
              const items = itemsByDay.get(date)?.filter((item) => !item.allDay && Number(item.time?.slice(0, 2)) === hour) ?? [];
              return <div key={`${date}-${hour}`} className="relative h-14 min-w-0 cursor-pointer overflow-visible border-b border-r hover:bg-secondary/60" onClick={() => onSelect({ type: "event", date, time: `${String(hour).padStart(2, "0")}:00` })}>{items.map((item, itemIndex) => {
                const layout = timedCalendarItemLayout(item.time!, item.durationMinutes, itemIndex, items.length);
                const timeLabel = item.endTime ? `${formatTime(item.time!)}–${formatTime(item.endTime)}` : formatTime(item.time!);
                return <ItemHoverDetails key={`${item.type}-${item.id}`} title={item.title} description={item.description} meta={timeLabel}><button onClick={(event) => { event.stopPropagation(); onSelect({ type: item.type, id: item.id }); }} className={cn("absolute z-10 min-w-0 overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-left text-[11px] font-semibold text-foreground shadow-sm hover:z-20 hover:brightness-95", item.completed && "line-through opacity-50")} style={{ ...categoryStyle(item.color), ...layout }}>{item.title}<span className="block truncate text-[10px] font-normal">{timeLabel}</span></button></ItemHoverDetails>;
              })}</div>;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function timedCalendarItemLayout(time: string, durationMinutes: number | null, itemIndex = 0, itemCount = 1): React.CSSProperties {
  const minutesIntoHour = timeToMinutes(time) % 60;
  const columnWidth = 100 / itemCount;
  return {
    top: `${(minutesIntoHour / 60) * 56}px`,
    height: `${Math.max(24, ((durationMinutes ?? 30) / 60) * 56)}px`,
    left: `calc(${itemIndex * columnWidth}% + 4px)`,
    width: `calc(${columnWidth}% - 6px)`,
  };
}

function WeekAllDayItem({ item, onSelect }: { item: CalendarItem; onSelect: (selection: CalendarSelection) => void }) {
  return <ItemHoverDetails title={item.title} description={item.description} meta={item.location}><button type="button" onClick={() => onSelect({ type: item.type, id: item.id })} className={cn("w-full min-w-0 overflow-hidden rounded-md border border-l-[3px] px-2 py-1.5 text-left text-foreground hover:brightness-95", item.completed && "opacity-50")} style={categoryStyle(item.color)}><span className={cn("line-clamp-2 break-words text-[11px] font-semibold leading-4 [overflow-wrap:anywhere]", item.completed && "line-through")}>{item.title}</span>{item.description && <span className="mt-0.5 line-clamp-2 break-words text-[10px] leading-3.5 text-muted-foreground [overflow-wrap:anywhere]">{item.description}</span>}</button></ItemHoverDetails>;
}

function ThreeMonthView({ anchor, timezone, tasks, events, lists, onSelect }: Omit<React.ComponentProps<typeof CalendarView>, "mode">) {
  const months = Array.from({ length: 3 }, (_, index) => addMonths(anchor, index));
  return <div className="min-h-0 flex-1 overflow-auto" data-testid="three-month-view"><div className="grid min-w-[760px] grid-cols-3 gap-4 p-4 pb-24">{months.map((month) => <CompactMonth key={dateKey(month)} month={month} timezone={timezone} tasks={tasks} events={events} lists={lists} onSelect={onSelect} />)}</div></div>;
}

function CompactMonth({ month, timezone, tasks, events, lists, onSelect }: { month: Date; timezone: string; tasks: TaskView[]; events: EventView[]; lists: ListView[]; onSelect: (selection: CalendarSelection) => void }) {
  const days = monthCalendarRange(month);
  return <section className="min-w-0 overflow-hidden rounded-xl border bg-card"><h2 className="border-b px-3 py-2 text-center font-semibold">{format(month, "MMMM yyyy")}</h2><div className="grid grid-cols-7 border-b">{Array.from({ length: 7 }, (_, index) => <div key={index} className="py-1.5 text-center text-[10px] font-semibold uppercase text-muted-foreground">{format(addDays(new Date(2026, 0, 4), index), "EEEEE")}</div>)}</div><div className="grid grid-cols-7">{days.map((day) => { const key = dateKey(day); const items = itemsForDate(key, timezone, tasks, events, lists); return <button key={key} type="button" onClick={() => onSelect({ type: "event", date: key })} aria-label={`${format(day, "MMMM d")}, ${items.length} items`} className={cn("min-h-16 min-w-0 overflow-hidden border-b border-r p-1 text-left hover:bg-secondary/60", !isSameMonth(day, month) && "bg-secondary/30 text-muted-foreground")}><span className={cn("grid size-5 place-items-center rounded-full text-[11px] font-medium", isToday(day) && "bg-primary text-primary-foreground")}>{format(day, "d")}</span><span className="mt-1 flex flex-wrap gap-0.5">{items.slice(0, 5).map((item) => <span key={`${item.type}-${item.id}`} className={cn("size-1.5", item.type === "event" ? "rounded-sm" : "rounded-full")} style={{ backgroundColor: item.color }} title={item.title} />)}{items.length > 5 && <span className="text-[9px] leading-none text-muted-foreground">+{items.length - 5}</span>}</span></button>; })}</div></section>;
}

function FutureEventsView({ timezone, events, lists, onSelect }: Pick<React.ComponentProps<typeof CalendarView>, "timezone" | "events" | "lists" | "onSelect">) {
  const today = dateKey(zonedNow(timezone));
  const upcoming = events.flatMap((event) => {
    const startDate = nextEventOccurrence(event, today, timezone);
    if (!startDate) return [];
    const range = eventDateRange(event, timezone);
    const time = event.allDay ? null : utcToLocalParts(event.startAt, timezone).time;
    return [{ event, startDate, endDate: dateKey(addDays(localDate(startDate), range.duration)), time }];
  }).sort((a, b) => a.startDate.localeCompare(b.startDate) || compareCalendarItems({ time: a.time, createdAt: a.event.createdAt }, { time: b.time, createdAt: b.event.createdAt }));

  return <div className="min-h-0 flex-1 overflow-auto" data-testid="events-view"><div className="mx-auto grid max-w-4xl gap-4 p-4 pb-24"><div><h2 className="text-lg font-semibold">All future events</h2><p className="text-sm text-muted-foreground">One-time events and the next occurrence of each recurring series.</p></div>{upcoming.length === 0 && <div className="grid place-items-center gap-2 py-20 text-center text-muted-foreground"><CalendarCheck2 className="size-9" /><p>No future events scheduled.</p></div>}{upcoming.map(({ event, startDate, endDate }) => <FutureEventCard key={event.id} event={event} startDate={startDate} endDate={endDate} timezone={timezone} lists={lists} onSelect={onSelect} />)}</div></div>;
}

function FutureEventCard({ event, startDate, endDate, timezone, lists, onSelect }: { event: EventView; startDate: string; endDate: string; timezone: string; lists: ListView[]; onSelect: (selection: CalendarSelection) => void }) {
  const category = lists.find((list) => list.id === event.listId);
  const color = calendarColor(event.color);
  const startTime = event.allDay ? null : utcToLocalParts(event.startAt, timezone).time;
  const endTime = event.allDay ? null : utcToLocalParts(event.endAt, timezone).time;
  return <ItemHoverDetails title={event.title} description={event.description} meta={event.location}><button type="button" onClick={() => onSelect({ type: "event", id: event.id })} className="grid w-full grid-cols-[140px_1fr] gap-4 rounded-xl border border-l-4 bg-card p-4 text-left hover:bg-secondary/50 max-sm:grid-cols-1 max-sm:gap-2" style={{ borderLeftColor: color }}><div><span className="flex items-center gap-1.5 text-sm font-semibold"><CalendarDays className="size-4" />{formatEventDateRange(startDate, endDate)}</span>{startTime && endTime && <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3" />{formatTime(startTime)}–{formatTime(endTime)}</span>}{event.recurrence && <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Repeat2 className="size-3" />{recurrenceLabel(event.recurrence)}</span>}</div><div className="min-w-0"><strong className="block text-base">{event.title}</strong>{event.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{event.description}</p>}<div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">{event.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{event.location}</span>}<span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />{category?.name ?? "Uncategorized"}</span></div></div></button></ItemHoverDetails>;
}

function eventDateRange(event: EventView, timezone: string) {
  const startDate = utcToLocalParts(event.startAt, timezone).date;
  const storedEnd = utcToLocalParts(event.endAt, timezone).date;
  const endDate = event.allDay ? dateKey(addDays(localDate(storedEnd), -1)) : storedEnd;
  return { startDate, endDate, duration: Math.max(0, differenceInCalendarDays(localDate(endDate), localDate(startDate))) };
}

function nextEventOccurrence(event: EventView, fromDate: string, timezone: string) {
  const currentOccurrence = occurrenceStartOnDate(event, fromDate, timezone);
  if (currentOccurrence) return currentOccurrence;
  const { startDate } = eventDateRange(event, timezone);
  if (!event.recurrence) return startDate >= fromDate ? startDate : null;
  if (event.recurrence.until && event.recurrence.until < fromDate) return null;
  const limit = event.recurrence.until ? Math.max(0, differenceInCalendarDays(localDate(event.recurrence.until), localDate(fromDate))) : 37000;
  for (let offset = 0; offset <= limit; offset += 1) {
    const candidate = dateKey(addDays(localDate(fromDate), offset));
    if (recurrenceMatchesDate(startDate, candidate, event.recurrence)) return candidate;
  }
  return null;
}

function formatEventDateRange(startDate: string, endDate: string) {
  const start = localDate(startDate);
  if (startDate === endDate) return format(start, "MMM d, yyyy");
  const end = localDate(endDate);
  return start.getFullYear() === end.getFullYear() ? `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}` : `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
}

function AgendaView({ anchor, timezone, tasks, events, lists, onSelect }: Omit<React.ComponentProps<typeof CalendarView>, "mode">) {
  const start = subDays(anchor, 2);
  const anchorKey = dateKey(anchor);
  const groups = Array.from({ length: 18 }, (_, index) => addDays(start, index)).map((day) => ({ day, items: itemsForDate(dateKey(day), timezone, tasks, events, lists) })).filter((group) => group.items.length || dateKey(group.day) === anchorKey);
  return (
    <div className="min-h-0 flex-1 overflow-auto" data-testid="agenda-view">
      <div className="mx-auto grid max-w-4xl gap-5 p-4 pb-24">
        {groups.length === 0 && <div className="grid place-items-center gap-2 py-20 text-center text-muted-foreground"><CalendarCheck2 className="size-9" /><p>No scheduled items in this range.</p></div>}
        {groups.map(({ day, items }) => <section key={dateKey(day)} className="grid grid-cols-[100px_minmax(0,1fr)] gap-4 max-sm:grid-cols-[70px_minmax(0,1fr)] max-sm:gap-2"><div className="font-semibold">{dateKey(day) === anchorKey && isToday(day) ? "Today" : format(day, "EEE")}<span className="block text-xs font-normal text-muted-foreground">{format(day, "MMM d")}</span></div><div className="min-w-0 overflow-hidden rounded-xl border bg-card">{items.length === 0 && <button type="button" onClick={() => onSelect({ type: "event", date: dateKey(day) })} className="min-h-14 w-full px-3 text-left text-sm text-muted-foreground hover:bg-secondary/60">No items scheduled — add one</button>}{items.map((item) => <ItemHoverDetails key={`${item.type}-${item.id}`} title={item.title} description={item.description} meta={item.location}><button onClick={() => onSelect({ type: item.type, id: item.id })} className="flex min-h-14 w-full min-w-0 items-center gap-3 overflow-hidden border-b px-3 text-left last:border-b-0 hover:bg-secondary/60"><span className="w-16 shrink-0 text-xs text-muted-foreground">{item.type === "task" ? (item.completed ? "Done" : "Due") : item.time ? formatTime(item.time) : "All day"}</span><span className={cn("size-2.5 shrink-0", item.type === "event" ? "rounded-sm" : "rounded-full")} style={{ backgroundColor: item.color }} /><span className="min-w-0"><strong className={cn("block truncate", item.completed && "line-through opacity-55")}>{item.title}</strong><span className="flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground">{item.type === "task" ? <><Clock3 className="size-3 shrink-0" />Task</> : item.location ? <><MapPin className="size-3 shrink-0" /><span className="truncate">{item.location}</span></> : "Event"}</span></span></button></ItemHoverDetails>)}</div></section>)}
      </div>
    </div>
  );
}

const legacyEventColors: Record<string, string> = { blue: "#2563eb", violet: "#7c3aed", teal: "#0f766e", amber: "#d97706", rose: "#db2777" };

function calendarColor(color: string) {
  return legacyEventColors[color] ?? color ?? "#64748b";
}

function categoryStyle(color: string): React.CSSProperties {
  return { borderLeftColor: color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` };
}

export function calendarPeriodLabel(mode: CalendarMode, anchor: Date) {
  if (mode === "today") return isToday(anchor) ? `Today · ${format(anchor, "MMM d")}` : format(anchor, "EEEE, MMM d, yyyy");
  if (mode === "events") return "Future events";
  if (mode === "agenda") return "My List";
  if (mode === "quarter") return `${format(anchor, "MMM")} – ${format(addMonths(anchor, 2), "MMM yyyy")}`;
  if (mode === "month") return format(anchor, "MMMM yyyy");
  const days = weekCalendarRange(anchor);
  return `${format(days[0], "MMM d")} – ${format(days[6], "MMM d, yyyy")}`;
}

export function shiftCalendarPeriod(mode: CalendarMode, anchor: Date, amount: number) {
  if (mode === "quarter") return addMonths(anchor, amount * 3);
  if (mode === "today") return addDays(anchor, amount);
  return mode === "month" ? addMonths(anchor, amount) : addDays(anchor, amount * 7);
}

export function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, hours, minutes));
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
