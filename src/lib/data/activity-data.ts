import { and, count, desc, eq, gt, lt, ne, or } from "drizzle-orm";

import { activityEvents, activityReadStates, workspaces } from "../../../db/schema";
import { activityDetailsSchema } from "@/lib/activity/schema";
import type { ActivityCursor, ActivityItemView, ActivityPage } from "@/lib/activity/types";
import { requireWorkspace } from "@/lib/authorization";
import { db } from "@/lib/db/client";

const PAGE_SIZE = 50;

function afterWatermark(lastSeenAt: Date | null, lastSeenEventId: string | null) {
  if (!lastSeenAt) return undefined;
  return or(
    gt(activityEvents.occurredAt, lastSeenAt),
    and(
      eq(activityEvents.occurredAt, lastSeenAt),
      lastSeenEventId ? gt(activityEvents.id, lastSeenEventId) : undefined,
    ),
  );
}

export async function getActivityPage(cursor?: ActivityCursor | null): Promise<ActivityPage> {
  const { user, membership } = await requireWorkspace();
  const workspaceId = membership.workspaceId;
  const [workspaceRows, readRows] = await Promise.all([
    db.select({ timezone: workspaces.timezone }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1),
    db.select({
      lastSeenAt: activityReadStates.lastSeenAt,
      lastSeenEventId: activityReadStates.lastSeenEventId,
      clearedThroughAt: activityReadStates.clearedThroughAt,
      clearedThroughEventId: activityReadStates.clearedThroughEventId,
    }).from(activityReadStates).where(and(eq(activityReadStates.workspaceId, workspaceId), eq(activityReadStates.userId, user.id))).limit(1),
  ]);
  const workspace = workspaceRows[0];
  if (!workspace) throw new Error("NOT_FOUND");
  const cursorDate = cursor ? new Date(cursor.occurredAt) : null;
  const pageCondition = cursorDate ? or(
    lt(activityEvents.occurredAt, cursorDate),
    and(eq(activityEvents.occurredAt, cursorDate), lt(activityEvents.id, cursor!.id)),
  ) : undefined;
  const readState = readRows[0];
  const unreadCondition = afterWatermark(readState?.lastSeenAt ?? membership.joinedAt, readState?.lastSeenEventId ?? null);
  const visibleCondition = afterWatermark(readState?.clearedThroughAt ?? null, readState?.clearedThroughEventId ?? null);

  const [rows, unreadRows] = await Promise.all([
    db.select().from(activityEvents).where(and(eq(activityEvents.workspaceId, workspaceId), visibleCondition, pageCondition)).orderBy(desc(activityEvents.occurredAt), desc(activityEvents.id)).limit(PAGE_SIZE + 1),
    db.select({ count: count() }).from(activityEvents).where(and(
      eq(activityEvents.workspaceId, workspaceId),
      ne(activityEvents.actorUserId, user.id),
      unreadCondition,
    )),
  ]);
  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = rows.slice(0, PAGE_SIZE);
  const items: ActivityItemView[] = pageRows.map((row) => {
    const parsed = activityDetailsSchema.safeParse(row.details);
    return {
      id: row.id,
      actorUserId: row.actorUserId,
      actorDisplayName: row.actorDisplayName,
      entityType: row.entityType as ActivityItemView["entityType"],
      entityId: row.entityId,
      entityTitle: row.entityTitle,
      actionType: row.actionType as ActivityItemView["actionType"],
      details: parsed.success ? parsed.data : null,
      occurredAt: row.occurredAt.toISOString(),
    };
  });
  const last = pageRows.at(-1);

  return {
    items,
    unreadCount: unreadRows[0]?.count ?? 0,
    nextCursor: hasMore && last ? { occurredAt: last.occurredAt.toISOString(), id: last.id } : null,
    workspaceTimezone: workspace.timezone,
    currentUserId: user.id,
  };
}
