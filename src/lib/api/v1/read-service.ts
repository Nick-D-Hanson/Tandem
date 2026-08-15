import { and, asc, desc, eq, gt, gte, isNotNull, lt, or } from "drizzle-orm";

import { events, taskLists, tasks, workspaces } from "../../../../db/schema";
import { requireWorkspace } from "@/lib/authorization";
import { db } from "@/lib/db/client";
import { localDateTimeToUtc } from "@/lib/dates/timezone";
import { parseRecurrence } from "@/lib/recurrence";
import type {
  ApiCalendarData,
  ApiCategoriesData,
  ApiEvent,
  ApiTask,
  ApiTasksData,
} from "./contracts";
import { apiCalendarDataSchema, apiCategoriesDataSchema, apiTasksDataSchema } from "./contracts";
import { calendarWindowEndExclusive, type CalendarWindow } from "./read-params";

const CALENDAR_RESULT_LIMIT = 500;

export async function getNativeCategories(): Promise<ApiCategoriesData> {
  const { membership } = await requireWorkspace();
  const rows = await db.select({
    id: taskLists.id,
    name: taskLists.name,
    color: taskLists.color,
    position: taskLists.position,
  }).from(taskLists)
    .where(eq(taskLists.workspaceId, membership.workspaceId))
    .orderBy(asc(taskLists.position), asc(taskLists.name))
    .limit(100);
  return apiCategoriesDataSchema.parse({ categories: rows });
}

export async function getNativeTasks(query: { limit: number; before?: string }): Promise<ApiTasksData> {
  const { membership } = await requireWorkspace();
  const before = query.before ? new Date(query.before) : undefined;
  const rows = await db.select().from(tasks)
    .where(and(eq(tasks.workspaceId, membership.workspaceId), before ? lt(tasks.updatedAt, before) : undefined))
    .orderBy(desc(tasks.updatedAt), desc(tasks.id))
    .limit(query.limit + 1);
  const hasMore = rows.length > query.limit;
  const page = rows.slice(0, query.limit).map(serializeTask);
  return apiTasksDataSchema.parse({
    tasks: page,
    nextCursor: hasMore ? page.at(-1)?.updatedAt ?? null : null,
  });
}

export async function getNativeCalendar(window: CalendarWindow): Promise<ApiCalendarData> {
  const { membership } = await requireWorkspace();
  const [workspace] = await db.select({ timezone: workspaces.timezone })
    .from(workspaces)
    .where(eq(workspaces.id, membership.workspaceId))
    .limit(1);
  if (!workspace) throw new Error("NOT_FOUND");

  const startAt = localDateTimeToUtc({ date: window.start }, workspace.timezone);
  const endAt = localDateTimeToUtc({ date: calendarWindowEndExclusive(window) }, workspace.timezone);
  const [taskRows, eventRows] = await Promise.all([
    db.select().from(tasks).where(and(
      eq(tasks.workspaceId, membership.workspaceId),
      or(and(gte(tasks.dueAt, startAt), lt(tasks.dueAt, endAt)), isNotNull(tasks.recurrence)),
    )).orderBy(asc(tasks.dueAt), asc(tasks.position)).limit(CALENDAR_RESULT_LIMIT + 1),
    db.select().from(events).where(and(
      eq(events.workspaceId, membership.workspaceId),
      or(and(lt(events.startAt, endAt), gt(events.endAt, startAt)), isNotNull(events.recurrence)),
    )).orderBy(asc(events.startAt)).limit(CALENDAR_RESULT_LIMIT + 1),
  ]);

  return apiCalendarDataSchema.parse({
    workspaceTimezone: workspace.timezone,
    start: window.start,
    end: window.end,
    tasks: taskRows.slice(0, CALENDAR_RESULT_LIMIT).map(serializeTask),
    events: eventRows.slice(0, CALENDAR_RESULT_LIMIT).map(serializeEvent),
    truncated: taskRows.length > CALENDAR_RESULT_LIMIT || eventRows.length > CALENDAR_RESULT_LIMIT,
  });
}

function serializeTask(task: typeof tasks.$inferSelect): ApiTask {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    dueAt: task.dueAt?.toISOString() ?? null,
    dueIsAllDay: task.dueIsAllDay,
    assigneeUserId: task.assigneeUserId,
    listId: task.listId,
    priority: task.priority as ApiTask["priority"],
    completedAt: task.completedAt?.toISOString() ?? null,
    recurrence: parseRecurrence(task.recurrence),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function serializeEvent(event: typeof events.$inferSelect): ApiEvent {
  return {
    id: event.id,
    listId: event.listId,
    title: event.title,
    description: event.description,
    location: event.location,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
    allDay: event.allDay,
    color: event.color,
    recurrence: parseRecurrence(event.recurrence),
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}
