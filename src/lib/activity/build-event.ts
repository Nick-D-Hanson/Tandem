import { addDays, format } from "date-fns";

import type { EventRow, TaskRow } from "../../../db/schema";
import type { ActivityActionType, ActivityChange, ActivityDetails, ActivityEntityType } from "@/lib/activity/schema";
import { dateKey, localDate, utcToLocalParts } from "@/lib/dates/timezone";

type NamedValue = { id: string; name: string } | null;
type SnapshotContext = {
  timezone: string;
  categories: Map<string, string>;
  members: Map<string, string>;
};

export type ActivityDraft = {
  entityType: ActivityEntityType;
  entityId: string;
  entityTitle: string;
  actionType: ActivityActionType;
  details: ActivityDetails;
};

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function category(id: string | null, categories: Map<string, string>): NamedValue {
  return id ? { id, name: categories.get(id) ?? "Unknown category" } : null;
}

function assignee(id: string | null, members: Map<string, string>): NamedValue {
  return id ? { id, name: members.get(id) ?? "Unknown member" } : null;
}

export function taskDateLabel(task: Pick<TaskRow, "dueAt" | "dueIsAllDay">, timezone: string) {
  if (!task.dueAt) return null;
  const parts = utcToLocalParts(task.dueAt, timezone);
  const date = format(localDate(parts.date), "MMM d");
  return task.dueIsAllDay ? date : `${date} at ${format(new Date(`2000-01-01T${parts.time}:00`), "h:mm a")}`;
}

export function eventDateLabel(event: Pick<EventRow, "startAt" | "endAt" | "allDay">, timezone: string) {
  const start = utcToLocalParts(event.startAt, timezone);
  const rawEnd = utcToLocalParts(event.endAt, timezone);
  const endDate = event.allDay ? dateKey(addDays(localDate(rawEnd.date), -1)) : rawEnd.date;
  const startLabel = format(localDate(start.date), "MMM d");
  const endLabel = format(localDate(endDate), "MMM d");
  if (event.allDay) return start.date === endDate ? startLabel : `${startLabel}–${endLabel}`;
  const startTime = format(new Date(`2000-01-01T${start.time}:00`), "h:mm a");
  const endTime = format(new Date(`2000-01-01T${rawEnd.time}:00`), "h:mm a");
  return start.date === endDate ? `${startLabel}, ${startTime}–${endTime}` : `${startLabel}, ${startTime}–${endLabel}, ${endTime}`;
}

function changed(field: ActivityChange["field"], beforeValue: string | null, beforeLabel: string | null, afterValue: string | null, afterLabel: string | null): ActivityChange | null {
  if (beforeValue === afterValue) return null;
  return { field, before: { value: beforeValue, label: beforeLabel }, after: { value: afterValue, label: afterLabel } };
}

function taskDetails(task: TaskRow, context: SnapshotContext, changes: ActivityChange[] = []): ActivityDetails {
  const taskCategory = category(task.listId, context.categories);
  const taskAssignee = assignee(task.assigneeUserId, context.members);
  return {
    version: 1,
    changes,
    snapshot: {
      dateLabel: taskDateLabel(task, context.timezone),
      categoryId: taskCategory?.id ?? null,
      categoryName: taskCategory?.name ?? null,
      priority: task.priority as ActivityDetails["snapshot"]["priority"],
      assigneeUserId: taskAssignee?.id ?? null,
      assigneeName: taskAssignee?.name ?? null,
      isRecurringSeries: Boolean(task.recurrence),
    },
  };
}

function eventDetails(event: EventRow, context: SnapshotContext, changes: ActivityChange[] = []): ActivityDetails {
  const eventCategory = category(event.listId, context.categories);
  return {
    version: 1,
    changes,
    snapshot: {
      dateLabel: eventDateLabel(event, context.timezone),
      categoryId: eventCategory?.id ?? null,
      categoryName: eventCategory?.name ?? null,
      priority: null,
      assigneeUserId: null,
      assigneeName: null,
      isRecurringSeries: Boolean(event.recurrence),
    },
  };
}

export function buildTaskCreated(task: TaskRow, context: SnapshotContext): ActivityDraft {
  return { entityType: "task", entityId: task.id, entityTitle: task.title, actionType: "created", details: taskDetails(task, context) };
}

export function buildTaskStateChange(task: TaskRow, context: SnapshotContext, actionType: "completed" | "reopened", beforeDueAt?: Date | null): ActivityDraft {
  const changes: ActivityChange[] = [];
  if (beforeDueAt?.getTime() !== task.dueAt?.getTime()) {
    const beforeTask = { ...task, dueAt: beforeDueAt ?? null };
    changes.push({ field: "date", before: { value: beforeDueAt?.toISOString() ?? null, label: taskDateLabel(beforeTask, context.timezone) }, after: { value: task.dueAt?.toISOString() ?? null, label: taskDateLabel(task, context.timezone) } });
  }
  return { entityType: "task", entityId: task.id, entityTitle: task.title, actionType, details: taskDetails(task, context, changes) };
}

export function buildTaskDeleted(task: TaskRow, context: SnapshotContext): ActivityDraft {
  return { entityType: "task", entityId: task.id, entityTitle: task.title, actionType: "deleted", details: taskDetails(task, context) };
}

export function buildTaskUpdated(before: TaskRow, after: TaskRow, context: SnapshotContext): ActivityDraft | null {
  const beforeCategory = category(before.listId, context.categories);
  const afterCategory = category(after.listId, context.categories);
  const beforeAssignee = assignee(before.assigneeUserId, context.members);
  const afterAssignee = assignee(after.assigneeUserId, context.members);
  const changes = [
    changed("date", before.dueAt?.toISOString() ?? null, taskDateLabel(before, context.timezone), after.dueAt?.toISOString() ?? null, taskDateLabel(after, context.timezone)),
    changed("category", beforeCategory?.id ?? null, beforeCategory?.name ?? "Inbox", afterCategory?.id ?? null, afterCategory?.name ?? "Inbox"),
    changed("priority", before.priority, titleCase(before.priority), after.priority, titleCase(after.priority)),
    changed("assignee", beforeAssignee?.id ?? null, beforeAssignee?.name ?? "Unassigned", afterAssignee?.id ?? null, afterAssignee?.name ?? "Unassigned"),
  ].filter((value): value is ActivityChange => Boolean(value));
  if (!changes.length) return null;
  return { entityType: "task", entityId: after.id, entityTitle: after.title, actionType: "updated", details: taskDetails(after, context, changes) };
}

export function buildEventCreated(event: EventRow, context: SnapshotContext): ActivityDraft {
  return { entityType: "event", entityId: event.id, entityTitle: event.title, actionType: "created", details: eventDetails(event, context) };
}

export function buildEventDeleted(event: EventRow, context: SnapshotContext): ActivityDraft {
  return { entityType: "event", entityId: event.id, entityTitle: event.title, actionType: "deleted", details: eventDetails(event, context) };
}

export function buildEventUpdated(before: EventRow, after: EventRow, context: SnapshotContext): ActivityDraft | null {
  const beforeCategory = category(before.listId, context.categories);
  const afterCategory = category(after.listId, context.categories);
  const beforeRange = `${before.startAt.toISOString()}/${before.endAt.toISOString()}/${before.allDay}`;
  const afterRange = `${after.startAt.toISOString()}/${after.endAt.toISOString()}/${after.allDay}`;
  const changes = [
    changed("date", beforeRange, eventDateLabel(before, context.timezone), afterRange, eventDateLabel(after, context.timezone)),
    changed("category", beforeCategory?.id ?? null, beforeCategory?.name ?? "No category", afterCategory?.id ?? null, afterCategory?.name ?? "No category"),
  ].filter((value): value is ActivityChange => Boolean(value));
  if (!changes.length) return null;
  return { entityType: "event", entityId: after.id, entityTitle: after.title, actionType: "updated", details: eventDetails(after, context, changes) };
}
