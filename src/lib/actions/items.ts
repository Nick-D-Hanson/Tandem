"use server";

import { addDays } from "date-fns";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { events, taskLists, tasks, workspaceMembers } from "../../../db/schema";
import { requireWorkspace } from "@/lib/authorization";
import { db } from "@/lib/db/client";
import { dateKey, localDate, localDateTimeToUtc } from "@/lib/dates/timezone";
import type { ActionResult } from "@/lib/types";
import { eventSchema, idSchema, listSchema, taskSchema } from "@/lib/validation/schemas";
import { actionFailure, validationFailure } from "./helpers";

async function validateRelations(workspaceId: string, listId?: string, assigneeUserId?: string) {
  if (listId) {
    const found = await db.select({ id: taskLists.id }).from(taskLists).where(and(eq(taskLists.id, listId), eq(taskLists.workspaceId, workspaceId))).limit(1);
    if (!found.length) throw new Error("NOT_FOUND");
  }
  if (assigneeUserId) {
    const found = await db.select({ id: workspaceMembers.id }).from(workspaceMembers).where(and(eq(workspaceMembers.userId, assigneeUserId), eq(workspaceMembers.workspaceId, workspaceId))).limit(1);
    if (!found.length) throw new Error("NOT_FOUND");
  }
}

export async function saveTaskAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { user, membership } = await requireWorkspace();
    const value = parsed.data;
    await validateRelations(membership.workspaceId, value.listId || undefined, value.assigneeUserId || undefined);
    const dueAt = value.dueDate ? localDateTimeToUtc({ date: value.dueDate, time: value.dueTime || null }, (await getWorkspaceTimezone(membership.workspaceId))) : null;
    const data = {
      title: value.title,
      notes: value.notes || null,
      dueAt,
      dueIsAllDay: !value.dueTime,
      assigneeUserId: value.assigneeUserId || null,
      listId: value.listId || null,
      priority: value.priority,
      updatedBy: user.id,
      updatedAt: new Date(),
    };
    if (value.id) {
      const [saved] = await db.update(tasks).set(data).where(and(eq(tasks.id, value.id), eq(tasks.workspaceId, membership.workspaceId))).returning({ id: tasks.id });
      if (!saved) throw new Error("NOT_FOUND");
      revalidatePath("/app");
      return { ok: true, data: saved };
    }
    const [saved] = await db.insert(tasks).values({ ...data, workspaceId: membership.workspaceId, createdBy: user.id }).returning({ id: tasks.id });
    revalidatePath("/app");
    return { ok: true, data: saved };
  } catch (error) {
    return actionFailure(error);
  }
}

async function getWorkspaceTimezone(workspaceId: string) {
  const { workspaces } = await import("../../../db/schema");
  const [workspace] = await db.select({ timezone: workspaces.timezone }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  if (!workspace) throw new Error("NOT_FOUND");
  return workspace.timezone;
}

export async function toggleTaskAction(input: { id: string; completed: boolean }): Promise<ActionResult> {
  const parsed = idSchema.safeParse({ id: input.id });
  if (!parsed.success) return { ok: false, error: "Invalid task." };
  try {
    const { user, membership } = await requireWorkspace();
    const [saved] = await db.update(tasks).set({ completedAt: input.completed ? new Date() : null, updatedBy: user.id, updatedAt: new Date() }).where(and(eq(tasks.id, input.id), eq(tasks.workspaceId, membership.workspaceId))).returning({ id: tasks.id });
    if (!saved) throw new Error("NOT_FOUND");
    revalidatePath("/app");
    return { ok: true, data: undefined };
  } catch (error) { return actionFailure(error); }
}

export async function deleteTaskAction(id: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: "Invalid task." };
  try {
    const { membership } = await requireWorkspace();
    const [deleted] = await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.workspaceId, membership.workspaceId))).returning({ id: tasks.id });
    if (!deleted) throw new Error("NOT_FOUND");
    revalidatePath("/app");
    return { ok: true, data: undefined };
  } catch (error) { return actionFailure(error); }
}

export async function saveEventAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { user, membership } = await requireWorkspace();
    const timezone = await getWorkspaceTimezone(membership.workspaceId);
    const value = parsed.data;
    const startAt = localDateTimeToUtc({ date: value.date, time: value.allDay ? null : value.startTime }, timezone);
    const endAt = value.allDay
      ? localDateTimeToUtc({ date: dateKey(addDays(localDate(value.date), 1)), time: null }, timezone)
      : localDateTimeToUtc({ date: value.date, time: value.endTime }, timezone);
    const data = {
      title: value.title,
      description: value.description || null,
      location: value.location || null,
      startAt,
      endAt,
      allDay: value.allDay,
      color: value.color,
      recurrence: value.recurrence === "none" ? null : value.recurrence,
      updatedBy: user.id,
      updatedAt: new Date(),
    };
    if (value.id) {
      const [saved] = await db.update(events).set(data).where(and(eq(events.id, value.id), eq(events.workspaceId, membership.workspaceId))).returning({ id: events.id });
      if (!saved) throw new Error("NOT_FOUND");
      revalidatePath("/app");
      return { ok: true, data: saved };
    }
    const [saved] = await db.insert(events).values({ ...data, workspaceId: membership.workspaceId, createdBy: user.id }).returning({ id: events.id });
    revalidatePath("/app");
    return { ok: true, data: saved };
  } catch (error) { return actionFailure(error); }
}

export async function deleteEventAction(id: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: "Invalid event." };
  try {
    const { membership } = await requireWorkspace();
    const [deleted] = await db.delete(events).where(and(eq(events.id, id), eq(events.workspaceId, membership.workspaceId))).returning({ id: events.id });
    if (!deleted) throw new Error("NOT_FOUND");
    revalidatePath("/app");
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
      revalidatePath("/app");
      return { ok: true, data: saved };
    }
    const [position] = await db.select({ position: taskLists.position }).from(taskLists).where(eq(taskLists.workspaceId, membership.workspaceId)).orderBy(desc(taskLists.position)).limit(1);
    const [saved] = await db.insert(taskLists).values({ workspaceId: membership.workspaceId, name: parsed.data.name, color: parsed.data.color, position: (position?.position ?? 0) + 1 }).returning({ id: taskLists.id });
    revalidatePath("/app");
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
    revalidatePath("/app");
    return { ok: true, data: undefined };
  } catch (error) { return actionFailure(error); }
}
