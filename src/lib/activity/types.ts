import type { ActivityActionType, ActivityDetails, ActivityEntityType } from "@/lib/activity/schema";

export type ActivityCursor = {
  occurredAt: string;
  id: string;
};

export type ActivityItemView = {
  id: string;
  actorUserId: string;
  actorDisplayName: string;
  entityType: ActivityEntityType;
  entityId: string;
  entityTitle: string;
  actionType: ActivityActionType;
  details: ActivityDetails | null;
  occurredAt: string;
};

export type ActivityPage = {
  items: ActivityItemView[];
  unreadCount: number;
  nextCursor: ActivityCursor | null;
  workspaceTimezone: string;
  currentUserId: string;
};
