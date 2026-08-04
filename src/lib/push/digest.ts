import "server-only";

import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";

import {
  activityDigestDeliveries,
  activityDigests,
  activityEvents,
  pushSubscriptions,
  workspaceMembers,
} from "../../../db/schema";
import { db } from "@/lib/db/client";
import { assignedToRecipientCount, buildDigestPayload, finalDigestStatus, relevantDigestActivities, RETRYABLE_DELIVERY_STATUSES, type DigestActivity, type DigestDeliveryStatus, type DigestWindow } from "@/lib/push/digest-core";
import { sanitizePushError } from "@/lib/push/errors";
import type { PushSender } from "@/lib/push/web-push";

export type DigestRunSummary = {
  recipients: number;
  sent: number;
  noActivity: number;
  failed: number;
  skippedExisting: number;
};


async function claimDigest(workspaceId: string, recipientUserId: string, window: DigestWindow) {
  const [created] = await db.insert(activityDigests).values({
    workspaceId,
    recipientUserId,
    digestDate: window.digestDate,
    windowStart: window.start,
    windowEnd: window.end,
  }).onConflictDoNothing().returning();
  if (created) return created;

  const [claimed] = await db.update(activityDigests).set({ status: "processing", updatedAt: new Date() }).where(and(
    eq(activityDigests.workspaceId, workspaceId),
    eq(activityDigests.recipientUserId, recipientUserId),
    eq(activityDigests.digestDate, window.digestDate),
    inArray(activityDigests.status, ["failed", "partial"]),
  )).returning();
  return claimed ?? null;
}

async function claimDelivery(digestId: string, subscriptionId: string) {
  await db.insert(activityDigestDeliveries).values({ digestId, pushSubscriptionId: subscriptionId }).onConflictDoNothing();
  const now = new Date();
  const [claimed] = await db.update(activityDigestDeliveries).set({
    status: "processing",
    attemptCount: sql`${activityDigestDeliveries.attemptCount} + 1`,
    lastAttemptedAt: now,
    errorCode: null,
    errorMessage: null,
    updatedAt: now,
  }).where(and(
    eq(activityDigestDeliveries.digestId, digestId),
    eq(activityDigestDeliveries.pushSubscriptionId, subscriptionId),
    inArray(activityDigestDeliveries.status, RETRYABLE_DELIVERY_STATUSES),
  )).returning({ id: activityDigestDeliveries.id });
  return claimed?.id ?? null;
}

async function processRecipient(workspaceId: string, recipientUserId: string, window: DigestWindow, sender: PushSender) {
  const digest = await claimDigest(workspaceId, recipientUserId, window);
  if (!digest) return "skipped" as const;

  const events = await db.select({
    actorUserId: activityEvents.actorUserId,
    actorDisplayName: activityEvents.actorDisplayName,
    entityType: activityEvents.entityType,
    actionType: activityEvents.actionType,
    details: activityEvents.details,
  }).from(activityEvents).where(and(
    eq(activityEvents.workspaceId, workspaceId),
    gte(activityEvents.occurredAt, window.start),
    lt(activityEvents.occurredAt, window.end),
  ));
  const digestEvents = relevantDigestActivities(events as DigestActivity[], recipientUserId);
  const assignedCount = assignedToRecipientCount(digestEvents, recipientUserId);
  if (!digestEvents.length) {
    await db.update(activityDigests).set({
      status: "no_activity",
      relevantActivityCount: 0,
      assignedToRecipientCount: 0,
      updatedAt: new Date(),
    }).where(eq(activityDigests.id, digest.id));
    return "no_activity" as const;
  }

  await db.update(activityDigests).set({
    relevantActivityCount: digestEvents.length,
    assignedToRecipientCount: assignedCount,
    updatedAt: new Date(),
  }).where(eq(activityDigests.id, digest.id));
  const subscriptions = await db.select().from(pushSubscriptions).where(and(
    eq(pushSubscriptions.workspaceId, workspaceId),
    eq(pushSubscriptions.userId, recipientUserId),
    eq(pushSubscriptions.enabled, true),
  ));
  const payload = buildDigestPayload(digestEvents, recipientUserId);

  for (const subscription of subscriptions) {
    const deliveryId = await claimDelivery(digest.id, subscription.id);
    if (!deliveryId) continue;
    let deliveryError: ReturnType<typeof sanitizePushError> | null = null;
    try {
      await sender.send({ endpoint: subscription.endpoint, p256dhKey: subscription.p256dhKey, authKey: subscription.authKey }, payload);
    } catch (error) {
      deliveryError = sanitizePushError(error);
    }
    if (!deliveryError) {
      const deliveredAt = new Date();
      // Persist the no-retry marker first. A later metadata failure must never
      // turn a successful external delivery back into a retryable state.
      await db.update(activityDigestDeliveries).set({ status: "sent", sentAt: deliveredAt, updatedAt: deliveredAt }).where(eq(activityDigestDeliveries.id, deliveryId));
      await db.update(pushSubscriptions).set({ lastSuccessfulDeliveryAt: deliveredAt, failureCount: 0, updatedAt: deliveredAt }).where(eq(pushSubscriptions.id, subscription.id)).catch(() => undefined);
    } else {
      const failedAt = new Date();
      await Promise.all([
        db.update(activityDigestDeliveries).set({
          status: deliveryError.expired ? "expired" : "failed",
          errorCode: deliveryError.code,
          errorMessage: deliveryError.message,
          updatedAt: failedAt,
        }).where(eq(activityDigestDeliveries.id, deliveryId)),
        db.update(pushSubscriptions).set({
          enabled: deliveryError.expired ? false : subscription.enabled,
          lastFailureAt: failedAt,
          failureCount: sql`${pushSubscriptions.failureCount} + 1`,
          updatedAt: failedAt,
        }).where(eq(pushSubscriptions.id, subscription.id)),
      ]);
    }
  }

  const deliveryStates = await db.select({ status: activityDigestDeliveries.status }).from(activityDigestDeliveries).where(eq(activityDigestDeliveries.digestId, digest.id));
  const status = finalDigestStatus(deliveryStates.map((delivery) => delivery.status as DigestDeliveryStatus));
  await db.update(activityDigests).set({ status, updatedAt: new Date() }).where(eq(activityDigests.id, digest.id));
  return status;
}

export async function processActivityDigests(window: DigestWindow, sender: PushSender): Promise<DigestRunSummary> {
  const recipients = await db.select({ workspaceId: workspaceMembers.workspaceId, userId: workspaceMembers.userId }).from(workspaceMembers);
  const summary: DigestRunSummary = { recipients: recipients.length, sent: 0, noActivity: 0, failed: 0, skippedExisting: 0 };
  for (const recipient of recipients) {
    const result = await processRecipient(recipient.workspaceId, recipient.userId, window, sender);
    if (result === "sent") summary.sent += 1;
    else if (result === "no_activity") summary.noActivity += 1;
    else if (result === "skipped") summary.skippedExisting += 1;
    else summary.failed += 1;
  }
  return summary;
}
