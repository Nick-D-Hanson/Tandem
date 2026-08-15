"use server";

import { and, asc, desc, eq } from "drizzle-orm";

import { agendaItems, agendaPreferences, workspaces } from "../../../db/schema";
import { rolloverOwnAgendaToToday } from "@/lib/api/v1/agenda-mutation-service";
import { requireWorkspace } from "@/lib/authorization";
import { db, neonSql } from "@/lib/db/client";
import { agendaDateWindow } from "@/lib/dates/timezone";
import type { ActionResult } from "@/lib/types";
import { agendaDaySchema, agendaItemCreateSchema, agendaItemUpdateSchema, agendaReorderSchema, agendaVisibilitySchema } from "@/lib/validation/schemas";
import { actionFailure, validationFailure } from "./helpers";

async function agendaContext() {
  const { user, membership } = await requireWorkspace();
  const [workspace] = await db.select({ timezone: workspaces.timezone }).from(workspaces).where(eq(workspaces.id, membership.workspaceId)).limit(1);
  if (!workspace) throw new Error("NOT_FOUND");
  return { userId: user.id, workspaceId: membership.workspaceId, timezone: workspace.timezone, window: agendaDateWindow(workspace.timezone) };
}

function assertEditableDate(date: string, window: ReturnType<typeof agendaDateWindow>) {
  if (!window.editable.includes(date)) throw new Error("NOT_FOUND");
}

export async function updateAgendaVisibility(input: unknown): Promise<ActionResult> {
  const parsed = agendaVisibilitySchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const context = await agendaContext();
    const isShared = parsed.data.visibility === "shared";
    await db.insert(agendaPreferences).values({ workspaceId: context.workspaceId, userId: context.userId, isShared }).onConflictDoUpdate({
      target: [agendaPreferences.workspaceId, agendaPreferences.userId],
      set: { isShared, updatedAt: new Date() },
    });
    return { ok: true, data: undefined };
  } catch (error) { return actionFailure(error); }
}

export async function createAgendaItem(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = agendaItemCreateSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const context = await agendaContext();
    if (!context.window.future.includes(parsed.data.date)) throw new Error("NOT_FOUND");
    const [lastItem] = await db.select({ position: agendaItems.position }).from(agendaItems).where(and(
      eq(agendaItems.workspaceId, context.workspaceId),
      eq(agendaItems.ownerUserId, context.userId),
      eq(agendaItems.agendaDate, parsed.data.date),
    )).orderBy(desc(agendaItems.position)).limit(1);
    const [saved] = await db.insert(agendaItems).values({
      workspaceId: context.workspaceId,
      ownerUserId: context.userId,
      agendaDate: parsed.data.date,
      content: parsed.data.content,
      position: (lastItem?.position ?? -1) + 1,
    }).returning({ id: agendaItems.id });
    return { ok: true, data: saved };
  } catch (error) { return actionFailure(error); }
}

export async function updateAgendaItem(input: unknown): Promise<ActionResult> {
  const parsed = agendaItemUpdateSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const context = await agendaContext();
    const [item] = await db.select({ date: agendaItems.agendaDate }).from(agendaItems).where(and(
      eq(agendaItems.id, parsed.data.id),
      eq(agendaItems.workspaceId, context.workspaceId),
      eq(agendaItems.ownerUserId, context.userId),
    )).limit(1);
    if (!item) throw new Error("NOT_FOUND");
    assertEditableDate(item.date, context.window);
    const [saved] = await db.update(agendaItems).set({ content: parsed.data.content, updatedAt: new Date() }).where(and(
      eq(agendaItems.id, parsed.data.id),
      eq(agendaItems.workspaceId, context.workspaceId),
      eq(agendaItems.ownerUserId, context.userId),
    )).returning({ id: agendaItems.id });
    if (!saved) throw new Error("NOT_FOUND");
    return { ok: true, data: undefined };
  } catch (error) { return actionFailure(error); }
}

export async function deleteAgendaItem(id: string): Promise<ActionResult> {
  const parsed = agendaItemUpdateSchema.pick({ id: true }).safeParse({ id });
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const context = await agendaContext();
    const [item] = await db.select({ date: agendaItems.agendaDate }).from(agendaItems).where(and(
      eq(agendaItems.id, parsed.data.id),
      eq(agendaItems.workspaceId, context.workspaceId),
      eq(agendaItems.ownerUserId, context.userId),
    )).limit(1);
    if (!item) throw new Error("NOT_FOUND");
    assertEditableDate(item.date, context.window);
    const [deleted] = await db.delete(agendaItems).where(and(
      eq(agendaItems.id, parsed.data.id),
      eq(agendaItems.workspaceId, context.workspaceId),
      eq(agendaItems.ownerUserId, context.userId),
    )).returning({ id: agendaItems.id });
    if (!deleted) throw new Error("NOT_FOUND");
    return { ok: true, data: undefined };
  } catch (error) { return actionFailure(error); }
}

export async function clearAgendaDay(input: unknown): Promise<ActionResult> {
  const parsed = agendaDaySchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const context = await agendaContext();
    assertEditableDate(parsed.data.date, context.window);
    const existing = await db.select({ id: agendaItems.id }).from(agendaItems).where(and(
      eq(agendaItems.workspaceId, context.workspaceId),
      eq(agendaItems.ownerUserId, context.userId),
      eq(agendaItems.agendaDate, parsed.data.date),
    )).orderBy(asc(agendaItems.position));
    if (!existing.length) throw new Error("NOT_FOUND");
    await db.delete(agendaItems).where(and(
      eq(agendaItems.workspaceId, context.workspaceId),
      eq(agendaItems.ownerUserId, context.userId),
      eq(agendaItems.agendaDate, parsed.data.date),
    ));
    return { ok: true, data: undefined };
  } catch (error) { return actionFailure(error); }
}

export async function reorderAgendaItems(input: unknown): Promise<ActionResult> {
  const parsed = agendaReorderSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const context = await agendaContext();
    parsed.data.days.forEach((day) => assertEditableDate(day.date, context.window));
    if (parsed.data.days.some((day) => day.date === context.window.yesterday)) {
      const [yesterdayItem] = await db.select({ id: agendaItems.id }).from(agendaItems).where(and(
        eq(agendaItems.workspaceId, context.workspaceId),
        eq(agendaItems.ownerUserId, context.userId),
        eq(agendaItems.agendaDate, context.window.yesterday),
      )).limit(1);
      if (!yesterdayItem) throw new Error("NOT_FOUND");
    }
    const payload = JSON.stringify(parsed.data.days);
    const result = await neonSql`
      WITH payload AS MATERIALIZED (
        SELECT
          (day.value->>'date')::date AS agenda_date,
          item.value::uuid AS id,
          (item.ordinality - 1)::integer AS position
        FROM jsonb_array_elements(${payload}::jsonb) AS day(value)
        CROSS JOIN LATERAL jsonb_array_elements_text(day.value->'itemIds') WITH ORDINALITY AS item(value, ordinality)
      ),
      affected_dates AS MATERIALIZED (
        SELECT DISTINCT (day.value->>'date')::date AS agenda_date
        FROM jsonb_array_elements(${payload}::jsonb) AS day(value)
      ),
      current_items AS MATERIALIZED (
        SELECT item.id, item.agenda_date
        FROM agenda_items AS item
        WHERE item.workspace_id = ${context.workspaceId}::uuid
          AND item.owner_user_id = ${context.userId}
          AND item.agenda_date IN (SELECT agenda_date FROM affected_dates)
        FOR UPDATE
      ),
      validation AS MATERIALIZED (
        SELECT
          (SELECT count(*) FROM payload) = (SELECT count(*) FROM current_items)
          AND (SELECT count(*) FROM payload) = (SELECT count(DISTINCT id) FROM payload)
          AND NOT EXISTS (SELECT 1 FROM payload p LEFT JOIN current_items c ON c.id = p.id WHERE c.id IS NULL)
          AND NOT EXISTS (SELECT 1 FROM current_items c LEFT JOIN payload p ON p.id = c.id WHERE p.id IS NULL)
          AS valid
      ),
      updated AS (
        UPDATE agenda_items AS item
        SET agenda_date = payload.agenda_date,
            position = payload.position,
            updated_at = now()
        FROM payload, validation
        WHERE validation.valid
          AND item.id = payload.id
          AND item.workspace_id = ${context.workspaceId}::uuid
          AND item.owner_user_id = ${context.userId}
        RETURNING item.id
      )
      SELECT validation.valid, (SELECT count(*) FROM updated)::text AS updated_count
      FROM validation
    `;
    const validation = result[0] as { valid?: boolean } | undefined;
    if (!validation?.valid) throw new Error("NOT_FOUND");
    return { ok: true, data: undefined };
  } catch (error) { return actionFailure(error); }
}

export async function rolloverAgendaToToday(): Promise<ActionResult<{ movedCount: number; today: string }>> {
  try {
    return { ok: true, data: await rolloverOwnAgendaToToday() };
  } catch (error) {
    return actionFailure(error);
  }
}
