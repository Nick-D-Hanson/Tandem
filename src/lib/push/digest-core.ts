import { format, subDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { activityDetailsSchema, type ActivityActionType, type ActivityEntityType } from "@/lib/activity/schema";

export const DIGEST_TIMEZONE = "America/Chicago";

export type DigestWindow = {
  shouldRun: boolean;
  localHour: number;
  digestDate: string;
  start: Date;
  end: Date;
};

export type DigestActivity = {
  actorUserId: string;
  actorDisplayName: string;
  entityType: ActivityEntityType;
  actionType: ActivityActionType;
  details: unknown;
};

export type DigestDeliveryStatus = "pending" | "processing" | "sent" | "expired" | "failed";
export const RETRYABLE_DELIVERY_STATUSES: DigestDeliveryStatus[] = ["pending", "failed"];

export function relevantDigestActivities(events: DigestActivity[], recipientUserId: string) {
  return events.filter((event) => event.actorUserId !== recipientUserId);
}

export function canAttemptDelivery(status: DigestDeliveryStatus) {
  return RETRYABLE_DELIVERY_STATUSES.includes(status);
}

export function finalDigestStatus(statuses: DigestDeliveryStatus[]) {
  const sentCount = statuses.filter((status) => status === "sent").length;
  if (sentCount === statuses.length && sentCount > 0) return "sent" as const;
  if (sentCount > 0) return "partial" as const;
  return "failed" as const;
}

function previousDate(date: string) {
  return format(subDays(new Date(`${date}T12:00:00`), 1), "yyyy-MM-dd");
}

export function centralDigestWindow(now: Date): DigestWindow {
  const digestDate = formatInTimeZone(now, DIGEST_TIMEZONE, "yyyy-MM-dd");
  const localHour = Number(formatInTimeZone(now, DIGEST_TIMEZONE, "H"));
  return {
    shouldRun: localHour === 19,
    localHour,
    digestDate,
    start: fromZonedTime(`${previousDate(digestDate)}T19:00:00`, DIGEST_TIMEZONE),
    end: fromZonedTime(`${digestDate}T19:00:00`, DIGEST_TIMEZONE),
  };
}

export function assignedToRecipientCount(events: DigestActivity[], recipientUserId: string) {
  return events.filter((event) => {
    if (event.entityType !== "task") return false;
    const parsed = activityDetailsSchema.safeParse(event.details);
    if (!parsed.success) return false;
    if (event.actionType === "created") return parsed.data.snapshot.assigneeUserId === recipientUserId;
    return parsed.data.changes.some((change) => change.field === "assignee" && change.after.value === recipientUserId);
  }).length;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function buildDigestPayload(events: DigestActivity[], recipientUserId: string) {
  const actors = [...new Set(events.map((event) => event.actorDisplayName))];
  const actorLabel = actors.length <= 2 ? actors.join(" and ") : `${actors[0]} and ${actors.length - 1} others`;
  const assigned = assignedToRecipientCount(events, recipientUserId);
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = `${event.entityType}:${event.actionType}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const parts: string[] = [];
  const labels: Array<[string, string, string?]> = [
    ["task:created", "new task"],
    ["task:completed", "completed task"],
    ["task:reopened", "reopened task"],
    ["task:deleted", "removed task"],
    ["task:updated", "task update"],
    ["event:created", "new event"],
    ["event:deleted", "removed event"],
    ["event:updated", "event update"],
  ];
  for (const [key, singular, pluralForm] of labels) {
    const count = counts.get(key) ?? 0;
    if (count) parts.push(plural(count, singular, pluralForm));
  }

  const prefix = `${plural(events.length, "workspace update")} from ${actorLabel}`;
  const detail = parts.length ? `: ${parts.join(", ")}` : "";
  const assignment = assigned ? `, including ${plural(assigned, "task")} assigned to you` : "";
  const detailedBody = `${prefix}${detail}${assignment}.`;
  const body = detailedBody.length <= 180 ? detailedBody : `${prefix}${assignment}.`;
  return JSON.stringify({
    title: "Tandem activity summary",
    body,
    url: "/app/my-list?activity=open",
  });
}
