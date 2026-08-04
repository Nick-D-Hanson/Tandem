import type { activityEvents } from "../../../db/schema";
import type { ActivityDraft } from "@/lib/activity/build-event";

export function activityInsertValues(input: ActivityDraft & {
  workspaceId: string;
  actorUserId: string;
  actorDisplayName: string;
}): typeof activityEvents.$inferInsert {
  return {
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    actorDisplayName: input.actorDisplayName,
    entityType: input.entityType,
    entityId: input.entityId,
    entityTitle: input.entityTitle,
    actionType: input.actionType,
    details: input.details,
  };
}
