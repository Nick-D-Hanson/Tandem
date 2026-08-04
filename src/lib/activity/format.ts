import { format, formatDistanceStrict, subDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import type { ActivityChange } from "@/lib/activity/schema";
import type { ActivityItemView } from "@/lib/activity/types";
import { dateKey, localDate, workspaceDateKey } from "@/lib/dates/timezone";

function quotedTitle(item: ActivityItemView) {
  return `${item.entityType === "task" ? "Task" : "Event"} ‘${item.entityTitle}’`;
}

function assignmentCopy(change: ActivityChange, viewerId: string) {
  const target = change.after.value === viewerId ? "you" : change.after.label;
  if (!change.before.value && change.after.value) return `assignee to ${target}`;
  if (change.before.value && !change.after.value) return "assignee to Unassigned";
  return `assignee from ${change.before.label} to ${target}`;
}

function changeCopy(change: ActivityChange, viewerId: string) {
  if (change.field === "assignee") return assignmentCopy(change, viewerId);
  const field = change.field === "date" ? "date" : change.field;
  return `${field} from ${change.before.label ?? "None"} to ${change.after.label ?? "None"}`;
}

function joinChanges(changes: string[]) {
  if (changes.length <= 1) return changes[0] ?? "tracked details";
  if (changes.length === 2) return `${changes[0]} and ${changes[1]}`;
  return `${changes.slice(0, -1).join(", ")}, and ${changes.at(-1)}`;
}

export function activitySentence(item: ActivityItemView, viewerId: string) {
  const actor = item.actorDisplayName;
  const entity = quotedTitle(item);
  const recurring = item.details?.snapshot.isRecurringSeries && item.entityType === "event" ? "recurring Event series" : null;
  const eventEntity = recurring ? `${recurring} ‘${item.entityTitle}’` : entity;
  if (!item.details) return `${actor} updated ${entity}.`;
  if (item.actionType === "created") {
    const timing = item.details.snapshot.dateLabel ? `${item.entityType === "task" ? " due" : " for"} ${item.details.snapshot.dateLabel}` : "";
    return `${actor} added ${entity}${timing}.`;
  }
  if (item.actionType === "completed") return `${actor} completed ${entity}${item.details.changes.length ? ` and moved it to ${item.details.changes[0].after.label}` : ""}.`;
  if (item.actionType === "reopened") return `${actor} reopened ${entity}.`;
  if (item.actionType === "deleted") return `${actor} removed ${eventEntity}.`;
  const changes = item.details.changes.map((change) => changeCopy(change, viewerId));
  return `${actor} changed ${eventEntity}: ${joinChanges(changes)}.`;
}

export function relativeActivityTime(occurredAt: string, now = new Date()) {
  return formatDistanceStrict(new Date(occurredAt), now, { addSuffix: true });
}

export function exactActivityTime(occurredAt: string, timezone: string) {
  return formatInTimeZone(occurredAt, timezone, "EEEE, MMMM d, yyyy 'at' h:mm:ss a zzz");
}

export function activityDayKey(occurredAt: string, timezone: string) {
  return formatInTimeZone(occurredAt, timezone, "yyyy-MM-dd");
}

export function activityDayLabel(day: string, timezone: string, now = new Date()) {
  const today = workspaceDateKey(timezone, now);
  if (day === today) return "Today";
  if (day === dateKey(subDays(localDate(today), 1))) return "Yesterday";
  return format(localDate(day), "EEEE, MMMM d");
}

export function mergeActivityItems(current: ActivityItemView[], incoming: ActivityItemView[]) {
  const existing = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !existing.has(item.id))];
}
