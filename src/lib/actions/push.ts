"use server";

import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

import { pushSubscriptions } from "../../../db/schema";
import { requireWorkspace } from "@/lib/authorization";
import { db } from "@/lib/db/client";
import type { ActionResult } from "@/lib/types";
import { pushEndpointSchema, pushSubscriptionSchema } from "@/lib/validation/schemas";
import { validationFailure } from "./helpers";

function pushActionFailure(error: unknown): ActionResult<never> {
  if (error instanceof Error) {
    if (error.message === "AUTH_REQUIRED") return { ok: false, error: "Please sign in to continue." };
    if (error.message === "WORKSPACE_REQUIRED") return { ok: false, error: "Create a workspace first." };
    if (error.message === "NOT_FOUND") return { ok: false, error: "That item is no longer available." };
  }
  // Never log PushSubscription endpoints or key material from provider/database errors.
  console.error("Unexpected Tandem push subscription error");
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function subscribePushAction(input: unknown): Promise<ActionResult> {
  const parsed = pushSubscriptionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { user, membership } = await requireWorkspace();
    const [existing] = await db.select({ workspaceId: pushSubscriptions.workspaceId, userId: pushSubscriptions.userId }).from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, parsed.data.endpoint)).limit(1);
    if (existing && (existing.workspaceId !== membership.workspaceId || existing.userId !== user.id)) throw new Error("NOT_FOUND");
    const userAgent = (await headers()).get("user-agent")?.slice(0, 500) ?? null;
    const [subscription] = await db.insert(pushSubscriptions).values({
      workspaceId: membership.workspaceId,
      userId: user.id,
      endpoint: parsed.data.endpoint,
      p256dhKey: parsed.data.keys.p256dh,
      authKey: parsed.data.keys.auth,
      userAgent,
      enabled: true,
      failureCount: 0,
      lastFailureAt: null,
    }).onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        p256dhKey: parsed.data.keys.p256dh,
        authKey: parsed.data.keys.auth,
        userAgent,
        enabled: true,
        failureCount: 0,
        lastFailureAt: null,
        updatedAt: new Date(),
      },
      setWhere: and(
        eq(pushSubscriptions.workspaceId, membership.workspaceId),
        eq(pushSubscriptions.userId, user.id),
      ),
    }).returning({ id: pushSubscriptions.id });
    if (!subscription) throw new Error("NOT_FOUND");
    return { ok: true, data: undefined };
  } catch (error) {
    return pushActionFailure(error);
  }
}

export async function unsubscribePushAction(input: unknown): Promise<ActionResult> {
  const parsed = pushEndpointSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That notification subscription is invalid." };
  try {
    const { user, membership } = await requireWorkspace();
    const [disabled] = await db.update(pushSubscriptions).set({ enabled: false, updatedAt: new Date() }).where(and(
      eq(pushSubscriptions.endpoint, parsed.data.endpoint),
      eq(pushSubscriptions.workspaceId, membership.workspaceId),
      eq(pushSubscriptions.userId, user.id),
    )).returning({ id: pushSubscriptions.id });
    if (!disabled) throw new Error("NOT_FOUND");
    return { ok: true, data: undefined };
  } catch (error) {
    return pushActionFailure(error);
  }
}

export async function getPushSubscriptionStateAction(input: unknown): Promise<ActionResult<{ enabled: boolean }>> {
  const parsed = pushEndpointSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That notification subscription is invalid." };
  try {
    const { user, membership } = await requireWorkspace();
    const [subscription] = await db.select({ enabled: pushSubscriptions.enabled }).from(pushSubscriptions).where(and(
      eq(pushSubscriptions.endpoint, parsed.data.endpoint),
      eq(pushSubscriptions.workspaceId, membership.workspaceId),
      eq(pushSubscriptions.userId, user.id),
    )).limit(1);
    return { ok: true, data: { enabled: subscription?.enabled ?? false } };
  } catch (error) {
    return pushActionFailure(error);
  }
}
