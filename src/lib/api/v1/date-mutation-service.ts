import { and, eq } from "drizzle-orm";

import { activityEvents, events, taskLists, tasks, workspaceMembers, workspaces } from "../../../../db/schema";
import { buildEventUpdated, buildTaskUpdated } from "@/lib/activity/build-event";
import { activityInsertValues } from "@/lib/activity/write";
import { requireWorkspace } from "@/lib/authorization";
import { moveEventToLocalDate, moveTaskToLocalDate } from "@/lib/calendar/date-move";
import { type DatabaseTransaction, withDatabaseTransaction } from "@/lib/db/transaction";

async function loadDateMoveContext(transaction: DatabaseTransaction, workspaceId: string) {
  const [[workspace], categoryRows, memberRows] = await Promise.all([
    transaction.select({ timezone: workspaces.timezone }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1),
    transaction.select({ id: taskLists.id, name: taskLists.name }).from(taskLists).where(eq(taskLists.workspaceId, workspaceId)),
    transaction.select({ userId: workspaceMembers.userId, displayName: workspaceMembers.displayName }).from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId)),
  ]);
  if (!workspace) throw new Error("NOT_FOUND");
  return {
    timezone: workspace.timezone,
    categories: new Map(categoryRows.map((row) => [row.id, row.name])),
    members: new Map(memberRows.map((row) => [row.userId, row.displayName])),
  };
}

export async function moveTaskDate(id: string, targetDate: string) {
  const { user, membership } = await requireWorkspace();
  return withDatabaseTransaction(async (transaction) => {
    const context = await loadDateMoveContext(transaction, membership.workspaceId);
    const [before] = await transaction.select().from(tasks).where(and(
      eq(tasks.id, id),
      eq(tasks.workspaceId, membership.workspaceId),
    )).for("update").limit(1);
    if (!before) throw new Error("NOT_FOUND");

    const dueAt = moveTaskToLocalDate({
      dueAt: before.dueAt,
      dueIsAllDay: before.dueIsAllDay,
      targetDate,
      timezone: context.timezone,
    });
    const [after] = await transaction.update(tasks).set({
      dueAt,
      updatedBy: user.id,
      updatedAt: new Date(),
    }).where(and(eq(tasks.id, id), eq(tasks.workspaceId, membership.workspaceId))).returning();
    if (!after) throw new Error("NOT_FOUND");
    const activity = buildTaskUpdated(before, after, context);
    if (activity) await transaction.insert(activityEvents).values(activityInsertValues({
      ...activity,
      workspaceId: membership.workspaceId,
      actorUserId: user.id,
      actorDisplayName: membership.displayName,
    }));
    return { id: after.id, dueAt: after.dueAt?.toISOString() ?? null, dueIsAllDay: after.dueIsAllDay };
  });
}

export async function moveEventDate(id: string, targetDate: string) {
  const { user, membership } = await requireWorkspace();
  return withDatabaseTransaction(async (transaction) => {
    const context = await loadDateMoveContext(transaction, membership.workspaceId);
    const [before] = await transaction.select().from(events).where(and(
      eq(events.id, id),
      eq(events.workspaceId, membership.workspaceId),
    )).for("update").limit(1);
    if (!before) throw new Error("NOT_FOUND");

    const moved = moveEventToLocalDate({
      startAt: before.startAt,
      endAt: before.endAt,
      allDay: before.allDay,
      recurrence: before.recurrence,
      targetDate,
      timezone: context.timezone,
    });
    const [after] = await transaction.update(events).set({
      ...moved,
      updatedBy: user.id,
      updatedAt: new Date(),
    }).where(and(eq(events.id, id), eq(events.workspaceId, membership.workspaceId))).returning();
    if (!after) throw new Error("NOT_FOUND");
    const activity = buildEventUpdated(before, after, context);
    if (activity) await transaction.insert(activityEvents).values(activityInsertValues({
      ...activity,
      workspaceId: membership.workspaceId,
      actorUserId: user.id,
      actorDisplayName: membership.displayName,
    }));
    return {
      id: after.id,
      startAt: after.startAt.toISOString(),
      endAt: after.endAt.toISOString(),
      allDay: after.allDay,
    };
  });
}
