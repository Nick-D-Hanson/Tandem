"use server";

import { addDays } from "date-fns";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { activityEvents, events, taskLists, tasks, workspaceMembers, workspaces } from "../../../db/schema";
import { buildEventCreated, buildEventDeleted, buildEventUpdated, buildTaskCreated, buildTaskDeleted, buildTaskStateChange, buildTaskUpdated, type ActivityDraft } from "@/lib/activity/build-event";
import { activityInsertValues } from "@/lib/activity/write";
import { requireWorkspace } from "@/lib/authorization";
import { db } from "@/lib/db/client";
import { type DatabaseTransaction, withDatabaseTransaction } from "@/lib/db/transaction";
import { dateKey, localDate, localDateTimeToUtc, utcToLocalParts } from "@/lib/dates/timezone";
import { nextRecurrenceDate, parseRecurrence, serializeRecurrence } from "@/lib/recurrence";
import type { ActionResult } from "@/lib/types";
import { eventSchema, idSchema, listSchema, taskSchema } from "@/lib/validation/schemas";
import { actionFailure, validationFailure } from "./helpers";

type MutationActor = { workspaceId: string; userId: string; displayName: string };

async function loadMutationContext(transaction: DatabaseTransaction, workspaceId: string) {
  const [workspace] = await transaction.select({ timezone: workspaces.timezone }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  if (!workspace) throw new Error("NOT_FOUND");
  const categoryRows = await transaction.select({ id: taskLists.id, name: taskLists.name, color: taskLists.color }).from(taskLists).where(eq(taskLists.workspaceId, workspaceId));
  const memberRows = await transaction.select({ userId: workspaceMembers.userId, displayName: workspaceMembers.displayName }).from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId));
  return {
    timezone: workspace.timezone,
    categories: new Map(categoryRows.map((category) => [category.id, category.name])),
    categoryColors: new Map(categoryRows.map((category) => [category.id, category.color])),
    members: new Map(memberRows.map((member) => [member.userId, member.displayName])),
  };
}

async function recordActivity(transaction: DatabaseTransaction, actor: MutationActor, draft: ActivityDraft | null) {
  if (!draft) return;
  await transaction.insert(activityEvents).values(activityInsertValues({
    ...draft,
    workspaceId: actor.workspaceId,
    actorUserId: actor.userId,
    actorDisplayName: actor.displayName,
  }));
}

function assertRelations(context: Awaited<ReturnType<typeof loadMutationContext>>, listId?: string, assigneeUserId?: string) {
  if (listId && !context.categories.has(listId)) throw new Error("NOT_FOUND");
  if (assigneeUserId && !context.members.has(assigneeUserId)) throw new Error("NOT_FOUND");
}

function actorFrom(workspaceId: string, userId: string, displayName: string): MutationActor {
  return { workspaceId, userId, displayName };
}

function revalidateProduct() {
  revalidatePath("/app");
  revalidatePath("/app/my-list");
}

export async function saveTaskAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { user, membership } = await requireWorkspace();
    const actor = actorFrom(membership.workspaceId, user.id, membership.displayName);
    const saved = await withDatabaseTransaction(async (transaction) => {
      const context = await loadMutationContext(transaction, membership.workspaceId);
      const value = parsed.data;
      assertRelations(context, value.listId || undefined, value.assigneeUserId || undefined);
      const dueAt = value.dueDate ? localDateTimeToUtc({ date: value.dueDate, time: value.dueTime || null }, context.timezone) : null;
      const data = {
        title: value.title,
        notes: value.notes || null,
        dueAt,
        dueIsAllDay: !value.dueTime,
        assigneeUserId: value.assigneeUserId || null,
        listId: value.listId || null,
        priority: value.priority,
        recurrence: serializeRecurrence(value.recurrence),
        updatedBy: user.id,
        updatedAt: new Date(),
      };
      if (value.id) {
        const [before] = await transaction.select().from(tasks).where(and(eq(tasks.id, value.id), eq(tasks.workspaceId, membership.workspaceId))).for("update").limit(1);
        if (!before) throw new Error("NOT_FOUND");
        const [updated] = await transaction.update(tasks).set(data).where(and(eq(tasks.id, value.id), eq(tasks.workspaceId, membership.workspaceId))).returning();
        if (!updated) throw new Error("NOT_FOUND");
        await recordActivity(transaction, actor, buildTaskUpdated(before, updated, context));
        return { id: updated.id };
      }
      const [created] = await transaction.insert(tasks).values({ ...data, workspaceId: membership.workspaceId, createdBy: user.id }).returning();
      if (!created) throw new Error("NOT_FOUND");
      await recordActivity(transaction, actor, buildTaskCreated(created, context));
      return { id: created.id };
    });
    revalidateProduct();
    return { ok: true, data: saved };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function toggleTaskAction(input: { id: string; completed: boolean }): Promise<ActionResult<{ advanced: boolean }>> {
  const parsed = idSchema.safeParse({ id: input.id });
  if (!parsed.success) return { ok: false, error: "Invalid task." };
  try {
    const { user, membership } = await requireWorkspace();
    const actor = actorFrom(membership.workspaceId, user.id, membership.displayName);
    const result = await withDatabaseTransaction(async (transaction) => {
      const context = await loadMutationContext(transaction, membership.workspaceId);
      const [before] = await transaction.select().from(tasks).where(and(eq(tasks.id, input.id), eq(tasks.workspaceId, membership.workspaceId))).for("update").limit(1);
      if (!before) throw new Error("NOT_FOUND");
      const rule = parseRecurrence(before.recurrence);
      let advanced = false;
      let dueAt = before.dueAt;
      let completedAt = input.completed ? new Date() : null;
      if (input.completed && rule && before.dueAt) {
        const current = utcToLocalParts(before.dueAt, context.timezone);
        const nextDate = nextRecurrenceDate(current.date, rule);
        if (nextDate) {
          dueAt = localDateTimeToUtc({ date: nextDate, time: before.dueIsAllDay ? null : current.time }, context.timezone);
          completedAt = null;
          advanced = true;
        }
      }
      const wasCompleted = Boolean(before.completedAt);
      if (!advanced && wasCompleted === input.completed) return { advanced: false };
      const [updated] = await transaction.update(tasks).set({ dueAt, completedAt, updatedBy: user.id, updatedAt: new Date() }).where(and(eq(tasks.id, input.id), eq(tasks.workspaceId, membership.workspaceId))).returning();
      if (!updated) throw new Error("NOT_FOUND");
      await recordActivity(transaction, actor, buildTaskStateChange(updated, context, input.completed ? "completed" : "reopened", before.dueAt));
      return { advanced };
    });
    revalidateProduct();
    return { ok: true, data: result };
  } catch (error) { return actionFailure(error); }
}

export async function deleteTaskAction(id: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: "Invalid task." };
  try {
    const { user, membership } = await requireWorkspace();
    const actor = actorFrom(membership.workspaceId, user.id, membership.displayName);
    await withDatabaseTransaction(async (transaction) => {
      const context = await loadMutationContext(transaction, membership.workspaceId);
      const [before] = await transaction.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.workspaceId, membership.workspaceId))).for("update").limit(1);
      if (!before) throw new Error("NOT_FOUND");
      const [deleted] = await transaction.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.workspaceId, membership.workspaceId))).returning({ id: tasks.id });
      if (!deleted) throw new Error("NOT_FOUND");
      await recordActivity(transaction, actor, buildTaskDeleted(before, context));
    });
    revalidateProduct();
    return { ok: true, data: undefined };
  } catch (error) { return actionFailure(error); }
}

export async function saveEventAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { user, membership } = await requireWorkspace();
    const actor = actorFrom(membership.workspaceId, user.id, membership.displayName);
    const saved = await withDatabaseTransaction(async (transaction) => {
      const context = await loadMutationContext(transaction, membership.workspaceId);
      const value = parsed.data;
      assertRelations(context, value.listId || undefined);
      const allDay = !value.startTime && !value.endTime;
      const startAt = localDateTimeToUtc({ date: value.date, time: value.startTime || null }, context.timezone);
      const endAt = allDay
        ? localDateTimeToUtc({ date: dateKey(addDays(localDate(value.endDate), 1)), time: null }, context.timezone)
        : localDateTimeToUtc({ date: value.endDate, time: value.endTime || null }, context.timezone);
      const data = {
        title: value.title,
        description: value.description || null,
        location: value.location || null,
        listId: value.listId || null,
        startAt,
        endAt,
        allDay,
        color: value.listId ? context.categoryColors.get(value.listId) ?? "#64748b" : "#64748b",
        recurrence: serializeRecurrence(value.recurrence),
        updatedBy: user.id,
        updatedAt: new Date(),
      };
      if (value.id) {
        const [before] = await transaction.select().from(events).where(and(eq(events.id, value.id), eq(events.workspaceId, membership.workspaceId))).for("update").limit(1);
        if (!before) throw new Error("NOT_FOUND");
        const [updated] = await transaction.update(events).set(data).where(and(eq(events.id, value.id), eq(events.workspaceId, membership.workspaceId))).returning();
        if (!updated) throw new Error("NOT_FOUND");
        await recordActivity(transaction, actor, buildEventUpdated(before, updated, context));
        return { id: updated.id };
      }
      const [created] = await transaction.insert(events).values({ ...data, workspaceId: membership.workspaceId, createdBy: user.id }).returning();
      if (!created) throw new Error("NOT_FOUND");
      await recordActivity(transaction, actor, buildEventCreated(created, context));
      return { id: created.id };
    });
    revalidateProduct();
    return { ok: true, data: saved };
  } catch (error) { return actionFailure(error); }
}

export async function deleteEventAction(id: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: "Invalid event." };
  try {
    const { user, membership } = await requireWorkspace();
    const actor = actorFrom(membership.workspaceId, user.id, membership.displayName);
    await withDatabaseTransaction(async (transaction) => {
      const context = await loadMutationContext(transaction, membership.workspaceId);
      const [before] = await transaction.select().from(events).where(and(eq(events.id, id), eq(events.workspaceId, membership.workspaceId))).for("update").limit(1);
      if (!before) throw new Error("NOT_FOUND");
      const [deleted] = await transaction.delete(events).where(and(eq(events.id, id), eq(events.workspaceId, membership.workspaceId))).returning({ id: events.id });
      if (!deleted) throw new Error("NOT_FOUND");
      await recordActivity(transaction, actor, buildEventDeleted(before, context));
    });
    revalidateProduct();
    return { ok: true, data: undefined };
  } catch (error) { return actionFailure(error); }
}

export async function saveListAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = listSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { membership } = await requireWorkspace();
    if (parsed.data.id) {
      const [saved] = await db.update(taskLists).set({ name: parsed.data.name, color: parsed.data.color, updatedAt: new Date() }).where(and(eq(taskLists.id, parsed.data.id), eq(taskLists.workspaceId, membership.workspaceId))).returning({ id: taskLists.id });
      if (!saved) throw new Error("NOT_FOUND");
      revalidateProduct();
      return { ok: true, data: saved };
    }
    const [position] = await db.select({ position: taskLists.position }).from(taskLists).where(eq(taskLists.workspaceId, membership.workspaceId)).orderBy(desc(taskLists.position)).limit(1);
    const [saved] = await db.insert(taskLists).values({ workspaceId: membership.workspaceId, name: parsed.data.name, color: parsed.data.color, position: (position?.position ?? 0) + 1 }).returning({ id: taskLists.id });
    revalidateProduct();
    return { ok: true, data: saved };
  } catch (error) { return actionFailure(error); }
}

export async function deleteListAction(id: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: "Invalid list." };
  try {
    const { membership } = await requireWorkspace();
    const [deleted] = await db.delete(taskLists).where(and(eq(taskLists.id, id), eq(taskLists.workspaceId, membership.workspaceId))).returning({ id: taskLists.id });
    if (!deleted) throw new Error("NOT_FOUND");
    revalidateProduct();
    return { ok: true, data: undefined };
  } catch (error) { return actionFailure(error); }
}
