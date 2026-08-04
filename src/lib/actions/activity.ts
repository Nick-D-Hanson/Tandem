"use server";

import { and, eq, isNull, lt, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { activityEvents, activityReadStates } from "../../../db/schema";
import { activityCursorSchema, activitySeenSchema } from "@/lib/activity/schema";
import type { ActivityPage } from "@/lib/activity/types";
import { requireWorkspace } from "@/lib/authorization";
import { db } from "@/lib/db/client";
import { getActivityPage } from "@/lib/data/activity-data";
import type { ActionResult } from "@/lib/types";
import { actionFailure } from "./helpers";

export async function loadMoreActivityAction(input: unknown): Promise<ActionResult<ActivityPage>> {
  const parsed = activityCursorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That activity page is no longer available." };
  try {
    return { ok: true, data: await getActivityPage(parsed.data) };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function markActivitySeenAction(input: unknown): Promise<ActionResult> {
  const parsed = activitySeenSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unable to mark activity as read." };
  try {
    const { user, membership } = await requireWorkspace();
    const occurredAt = new Date(parsed.data.occurredAt);
    const [accessibleEvent] = await db.select({ id: activityEvents.id }).from(activityEvents).where(and(
      eq(activityEvents.id, parsed.data.id),
      eq(activityEvents.workspaceId, membership.workspaceId),
      eq(activityEvents.occurredAt, occurredAt),
    )).limit(1);
    if (!accessibleEvent) throw new Error("NOT_FOUND");
    await db.insert(activityReadStates).values({
      workspaceId: membership.workspaceId,
      userId: user.id,
      lastSeenAt: occurredAt,
      lastSeenEventId: parsed.data.id,
    }).onConflictDoUpdate({
      target: [activityReadStates.workspaceId, activityReadStates.userId],
      set: { lastSeenAt: occurredAt, lastSeenEventId: parsed.data.id, updatedAt: new Date() },
      setWhere: or(
        isNull(activityReadStates.lastSeenAt),
        lt(activityReadStates.lastSeenAt, occurredAt),
        and(eq(activityReadStates.lastSeenAt, occurredAt), or(isNull(activityReadStates.lastSeenEventId), lt(activityReadStates.lastSeenEventId, parsed.data.id))),
      ),
    });
    revalidatePath("/app");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error);
  }
}
