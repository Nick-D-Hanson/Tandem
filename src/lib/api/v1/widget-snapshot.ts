import { addDays } from "date-fns";

import { dateKey, formatWorkspaceDate, localDate, utcToLocalParts, workspaceDateKey } from "@/lib/dates/timezone";
import type { ApiCalendarData, ApiCategoriesData, ApiWidgetSnapshotData } from "./contracts";
import { apiWidgetSnapshotDataSchema } from "./contracts";

type WidgetSource = {
  calendar: ApiCalendarData;
  categories: ApiCategoriesData;
  now?: Date;
};

type SortableWidgetItem = ApiWidgetSnapshotData["upcoming"][number] & { sortAt: number; localDate: string };

export function buildWidgetSnapshot({ calendar, categories, now = new Date() }: WidgetSource): ApiWidgetSnapshotData {
  const timezone = calendar.workspaceTimezone;
  const today = workspaceDateKey(timezone, now);
  const categoryColors = new Map(categories.categories.map((category) => [category.id, category.color]));
  const taskItems: SortableWidgetItem[] = calendar.tasks.flatMap((task) => {
    if (!task.dueAt || task.completedAt) return [];
    const local = utcToLocalParts(task.dueAt, timezone);
    return [{
      type: "task" as const,
      id: task.id,
      title: task.title,
      dateLabel: formatWorkspaceDate(task.dueAt, timezone),
      categoryColor: task.listId ? categoryColors.get(task.listId) ?? "#8790A4" : "#8790A4",
      priority: titlePriority(task.priority),
      sortAt: new Date(task.dueAt).getTime(),
      localDate: local.date,
    }];
  });
  const eventItems: SortableWidgetItem[] = calendar.events.map((event) => ({
    type: "event" as const,
    id: event.id,
    title: event.title,
    dateLabel: formatWorkspaceDate(event.startAt, timezone),
    categoryColor: event.color,
    priority: null,
    sortAt: new Date(event.startAt).getTime(),
    localDate: utcToLocalParts(event.startAt, timezone).date,
  }));
  const sorted = [...eventItems, ...taskItems].sort((left, right) => left.sortAt - right.sortAt || left.id.localeCompare(right.id));
  const nextUp = sorted.filter((item) => item.sortAt >= now.getTime() || item.localDate === today).slice(0, 1).map(stripSort);

  return apiWidgetSnapshotDataSchema.parse({
    generatedAt: now.toISOString(),
    workspaceTimeZone: timezone,
    localDate: today,
    nextUp,
    today: {
      calendar: eventItems.filter((item) => eventOccursOnLocalDate(item, calendar, today, timezone)).sort(sortWidgetItem).slice(0, 5).map(stripSort),
      tasks: taskItems.filter((item) => item.localDate === today).sort(sortWidgetItem).slice(0, 5).map(stripSort),
    },
    upcoming: sorted.filter((item) => item.localDate > today).slice(0, 5).map(stripSort),
  });
}

export function widgetSnapshotWindow(timezone: string, now = new Date()) {
  const start = workspaceDateKey(timezone, now);
  return { start, end: dateKey(addDays(localDate(start), 7)) };
}

function eventOccursOnLocalDate(item: SortableWidgetItem, calendar: ApiCalendarData, target: string, timezone: string) {
  const event = calendar.events.find((candidate) => candidate.id === item.id);
  if (!event) return false;
  const start = utcToLocalParts(event.startAt, timezone).date;
  const rawEnd = utcToLocalParts(event.endAt, timezone).date;
  const end = event.allDay ? dateKey(addDays(localDate(rawEnd), -1)) : rawEnd;
  return start <= target && end >= target;
}

function sortWidgetItem(left: SortableWidgetItem, right: SortableWidgetItem) {
  return left.sortAt - right.sortAt || left.id.localeCompare(right.id);
}

function stripSort(item: SortableWidgetItem) {
  return {
    type: item.type,
    id: item.id,
    title: item.title,
    dateLabel: item.dateLabel,
    categoryColor: item.categoryColor,
    priority: item.priority,
  };
}

function titlePriority(priority: "none" | "low" | "medium" | "high") {
  return (priority.charAt(0).toUpperCase() + priority.slice(1)) as "None" | "Low" | "Medium" | "High";
}
