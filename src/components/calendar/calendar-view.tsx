"use client";

import { addDays, addMonths, differenceInCalendarDays, format, isSameMonth, isToday, subDays } from "date-fns";
import { CalendarCheck2, Clock3, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";
import { dateKey, localDate, monthCalendarRange, utcToLocalParts, weekCalendarRange } from "@/lib/dates/timezone";
import { recurrenceMatchesDate } from "@/lib/recurrence";
import type { EventView, ListView, TaskView } from "@/lib/types";

export type CalendarMode = "month" | "week" | "agenda";
export type CalendarSelection = { type: "event" | "task"; id?: string; date?: string; time?: string };

type CalendarItem = {
  id: string;
  type: "event" | "task";
  title: string;
  date: string;
  time: string | null;
  allDay: boolean;
  completed: boolean;
  location?: string | null;
  color: string;
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
  if (mode === "week") return <WeekView anchor={anchor} timezone={timezone} tasks={tasks} events={events} lists={lists} onSelect={onSelect} />;
  if (mode === "agenda") return <AgendaView anchor={anchor} timezone={timezone} tasks={tasks} events={events} lists={lists} onSelect={onSelect} />;
  return <MonthView anchor={anchor} timezone={timezone} tasks={tasks} events={events} lists={lists} onSelect={onSelect} />;
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
    return [{ id: event.id, type: "event" as const, title: event.title, date, time: event.allDay || occurrenceStart !== date ? null : parts.time, allDay: event.allDay || occurrenceStart !== date, completed: false, location: event.location, color: calendarColor(event.color) }];
  });
  const taskItems = tasks.filter((task) => task.dueAt && utcToLocalParts(task.dueAt, timezone).date === date).map((task) => {
    const parts = utcToLocalParts(task.dueAt!, timezone);
    return { id: task.id, type: "task" as const, title: task.title, date, time: task.dueIsAllDay ? null : parts.time, allDay: task.dueIsAllDay, completed: Boolean(task.completedAt), color: lists.find((list) => list.id === task.listId)?.color ?? "#64748b" };
  });
  return [...eventItems, ...taskItems].sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));
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
    <button type="button" onClick={(event) => { event.stopPropagation(); onSelect({ type: item.type, id: item.id }); }} className={cn("flex min-h-6 min-w-0 items-center gap-1 rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-[11px] font-semibold text-foreground hover:brightness-95 max-[820px]:min-h-5 max-[820px]:justify-center max-[820px]:px-1 max-[820px]:text-[10px]", item.completed && "opacity-50 line-through")} style={categoryStyle(item.color)}>
      <span className={cn("size-1.5 shrink-0 bg-current max-[820px]:hidden", item.type === "event" ? "rounded-sm" : "rounded-full")} style={{ backgroundColor: item.color }} />
      <span className="truncate">{item.time ? `${formatTime(item.time)} ` : ""}{item.title}</span>
    </button>
  );
}

function WeekView({ anchor, timezone, tasks, events, lists, onSelect }: Omit<React.ComponentProps<typeof CalendarView>, "mode">) {
  const days = weekCalendarRange(anchor);
  const dayKeys = days.map(dateKey);
  const allDayItems = dayKeys.map((date) => itemsForDate(date, timezone, tasks, events, lists).filter((item) => item.allDay));
  return (
    <div className="min-h-0 flex-1 overflow-auto" data-testid="week-view">
      <div className="grid min-w-[720px] grid-cols-[64px_repeat(7,minmax(90px,1fr))]">
        <div className="sticky top-0 z-20 border-b border-r bg-card" />
        {days.map((day) => <div key={dateKey(day)} className="sticky top-0 z-20 border-b border-r bg-card p-2 text-center"><span className="block text-[11px] font-semibold uppercase text-muted-foreground">{format(day, "EEE")}</span><strong className={cn("mx-auto mt-0.5 grid size-7 place-items-center rounded-full", isToday(day) && "bg-primary text-primary-foreground")}>{format(day, "d")}</strong></div>)}
        <div className="border-b border-r px-2 py-2 text-right text-[10px] font-semibold uppercase text-muted-foreground">All day</div>
        {allDayItems.map((items, dayIndex) => <div key={dayKeys[dayIndex]} className="min-h-12 border-b border-r p-1">{items.map((item) => <CalendarPill key={`${item.type}-${item.id}`} item={item} onSelect={onSelect} />)}</div>)}
        {Array.from({ length: 14 }, (_, hourIndex) => hourIndex + 7).map((hour) => (
          <div className="contents" key={hour}>
            <div className="h-14 border-b border-r px-2 pt-1 text-right text-[11px] text-muted-foreground">{formatTime(`${String(hour).padStart(2, "0")}:00`)}</div>
            {dayKeys.map((date) => {
              const items = itemsForDate(date, timezone, tasks, events, lists).filter((item) => !item.allDay && Number(item.time?.slice(0, 2)) === hour);
              return <div key={`${date}-${hour}`} className="relative h-14 cursor-pointer border-b border-r p-1 hover:bg-secondary/60" onClick={() => onSelect({ type: "event", date, time: `${String(hour).padStart(2, "0")}:00` })}>{items.map((item) => <button key={`${item.type}-${item.id}`} onClick={(event) => { event.stopPropagation(); onSelect({ type: item.type, id: item.id }); }} className={cn("block w-full truncate rounded-md border-l-[3px] px-1.5 py-1 text-left text-[11px] font-semibold text-foreground", item.completed && "line-through opacity-50")} style={categoryStyle(item.color)}>{item.title}<span className="block text-[10px] font-normal">{formatTime(item.time!)}</span></button>)}</div>;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function AgendaView({ anchor, timezone, tasks, events, lists, onSelect }: Omit<React.ComponentProps<typeof CalendarView>, "mode">) {
  const start = subDays(anchor, 2);
  const groups = Array.from({ length: 18 }, (_, index) => addDays(start, index)).map((day) => ({ day, items: itemsForDate(dateKey(day), timezone, tasks, events, lists) })).filter((group) => group.items.length);
  return (
    <div className="min-h-0 flex-1 overflow-auto" data-testid="agenda-view">
      <div className="mx-auto grid max-w-4xl gap-5 p-4 pb-24">
        {groups.length === 0 && <div className="grid place-items-center gap-2 py-20 text-center text-muted-foreground"><CalendarCheck2 className="size-9" /><p>No scheduled items in this range.</p></div>}
        {groups.map(({ day, items }) => <section key={dateKey(day)} className="grid grid-cols-[100px_1fr] gap-4 max-sm:grid-cols-[70px_1fr] max-sm:gap-2"><div className="font-semibold">{format(day, "EEE")}<span className="block text-xs font-normal text-muted-foreground">{format(day, "MMM d")}</span></div><div className="overflow-hidden rounded-xl border bg-card">{items.map((item) => <button key={`${item.type}-${item.id}`} onClick={() => onSelect({ type: item.type, id: item.id })} className="flex min-h-14 w-full items-center gap-3 border-b px-3 text-left last:border-b-0 hover:bg-secondary/60"><span className="w-16 shrink-0 text-xs text-muted-foreground">{item.type === "task" ? (item.completed ? "Done" : "Due") : item.time ? formatTime(item.time) : "All day"}</span><span className={cn("size-2.5 shrink-0", item.type === "event" ? "rounded-sm" : "rounded-full")} style={{ backgroundColor: item.color }} /><span className="min-w-0"><strong className={cn("block truncate", item.completed && "line-through opacity-55")}>{item.title}</strong><span className="flex items-center gap-1 text-xs text-muted-foreground">{item.type === "task" ? <><Clock3 className="size-3" />Task</> : item.location ? <><MapPin className="size-3" />{item.location}</> : "Event"}</span></span></button>)}</div></section>)}
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
  if (mode === "agenda") return "Agenda";
  if (mode === "month") return format(anchor, "MMMM yyyy");
  const days = weekCalendarRange(anchor);
  return `${format(days[0], "MMM d")} – ${format(days[6], "MMM d, yyyy")}`;
}

export function shiftCalendarPeriod(mode: CalendarMode, anchor: Date, amount: number) {
  return mode === "month" ? addMonths(anchor, amount) : addDays(anchor, amount * 7);
}

export function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, hours, minutes));
}
