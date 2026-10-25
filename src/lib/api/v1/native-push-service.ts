import { and, eq } from "drizzle-orm";

import { nativePushDevices } from "../../../../db/schema";
import { requireWorkspace } from "@/lib/authorization";
import { withDatabaseTransaction } from "@/lib/db/transaction";

export async function registerNativePushDevice(input: { deviceId: string; platform: "ios"; expoPushToken: string }) {
  const { user, membership } = await requireWorkspace();
  return withDatabaseTransaction(async (transaction) => {
    const [tokenOwner] = await transaction.select({
      workspaceId: nativePushDevices.workspaceId,
      userId: nativePushDevices.userId,
      deviceId: nativePushDevices.deviceId,
    }).from(nativePushDevices).where(eq(nativePushDevices.expoPushToken, input.expoPushToken)).for("update").limit(1);
    if (tokenOwner && (
      tokenOwner.workspaceId !== membership.workspaceId
      || tokenOwner.userId !== user.id
      || tokenOwner.deviceId !== input.deviceId
    )) throw new Error("NOT_FOUND");

    const now = new Date();
    const [device] = await transaction.insert(nativePushDevices).values({
      workspaceId: membership.workspaceId,
      userId: user.id,
      deviceId: input.deviceId,
      expoPushToken: input.expoPushToken,
      platform: input.platform,
      enabled: true,
      lastRegisteredAt: now,
    }).onConflictDoUpdate({
      target: [nativePushDevices.workspaceId, nativePushDevices.userId, nativePushDevices.deviceId],
      set: { expoPushToken: input.expoPushToken, enabled: true, lastRegisteredAt: now, updatedAt: now },
    }).returning({ id: nativePushDevices.id, deviceId: nativePushDevices.deviceId, platform: nativePushDevices.platform, enabled: nativePushDevices.enabled });
    if (!device) throw new Error("INTERNAL_ERROR");
    return { ...device, platform: "ios" as const };
  });
}

export async function disableNativePushDevice(deviceId: string) {
  const { user, membership } = await requireWorkspace();
  const [device] = await withDatabaseTransaction((transaction) => transaction.update(nativePushDevices).set({
    enabled: false,
    updatedAt: new Date(),
  }).where(and(
    eq(nativePushDevices.workspaceId, membership.workspaceId),
    eq(nativePushDevices.userId, user.id),
    eq(nativePushDevices.deviceId, deviceId),
  )).returning({ id: nativePushDevices.id, deviceId: nativePushDevices.deviceId, platform: nativePushDevices.platform, enabled: nativePushDevices.enabled }));
  if (!device) throw new Error("NOT_FOUND");
  return { ...device, platform: "ios" as const };
}
