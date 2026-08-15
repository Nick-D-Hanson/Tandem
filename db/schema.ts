import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull(),
  createdBy: text("created_by").notNull(),
  ...auditColumns,
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("workspace_members_workspace_user_unique").on(table.workspaceId, table.userId),
    uniqueIndex("workspace_members_user_unique").on(table.userId),
    index("workspace_members_user_idx").on(table.userId),
  ],
);

export const workspaceInvites = pgTable(
  "workspace_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdBy: text("created_by").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedBy: text("accepted_by"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("workspace_invites_token_hash_unique").on(table.tokenHash),
    index("workspace_invites_active_idx").on(table.tokenHash, table.expiresAt, table.revokedAt),
  ],
);

export const taskLists = pgTable(
  "task_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    position: integer("position").notNull().default(0),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("task_lists_workspace_name_unique").on(table.workspaceId, table.name),
    index("task_lists_workspace_idx").on(table.workspaceId, table.position),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    listId: uuid("list_id").references(() => taskLists.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    notes: text("notes"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    dueIsAllDay: boolean("due_is_all_day").notNull().default(true),
    assigneeUserId: text("assignee_user_id"),
    priority: text("priority").notNull().default("none"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    recurrence: text("recurrence"),
    position: integer("position").notNull().default(0),
    createdBy: text("created_by").notNull(),
    updatedBy: text("updated_by").notNull(),
    ...auditColumns,
  },
  (table) => [
    check("tasks_priority_check", sql`${table.priority} in ('none', 'low', 'medium', 'high')`),
    index("tasks_workspace_due_idx").on(table.workspaceId, table.dueAt),
    index("tasks_workspace_completed_idx").on(table.workspaceId, table.completedAt),
    index("tasks_workspace_list_idx").on(table.workspaceId, table.listId),
    index("tasks_workspace_assignee_idx").on(table.workspaceId, table.assigneeUserId),
  ],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    listId: uuid("list_id").references(() => taskLists.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    allDay: boolean("all_day").notNull().default(false),
    color: text("color").notNull(),
    recurrence: text("recurrence"),
    createdBy: text("created_by").notNull(),
    updatedBy: text("updated_by").notNull(),
    ...auditColumns,
  },
  (table) => [
    check("events_time_order_check", sql`${table.endAt} > ${table.startAt}`),
    index("events_workspace_start_end_idx").on(table.workspaceId, table.startAt, table.endAt),
    index("events_workspace_list_idx").on(table.workspaceId, table.listId),
  ],
);

export const agendaPreferences = pgTable(
  "agenda_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    visibleDays: integer("visible_days").notNull().default(3),
    isShared: boolean("is_shared").notNull().default(false),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("agenda_preferences_workspace_user_unique").on(table.workspaceId, table.userId),
    index("agenda_preferences_workspace_user_idx").on(table.workspaceId, table.userId),
    check("agenda_preferences_visible_days_check", sql`${table.visibleDays} between 1 and 3`),
  ],
);

export const agendaItems = pgTable(
  "agenda_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    ownerUserId: text("owner_user_id").notNull(),
    agendaDate: date("agenda_date", { mode: "string" }).notNull(),
    content: text("content").notNull(),
    position: integer("position").notNull().default(0),
    ...auditColumns,
  },
  (table) => [
    index("agenda_items_owner_date_position_idx").on(table.workspaceId, table.ownerUserId, table.agendaDate, table.position),
    check("agenda_items_content_check", sql`length(btrim(${table.content})) between 1 and 300`),
    check("agenda_items_position_check", sql`${table.position} >= 0`),
  ],
);

export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").notNull(),
    actorDisplayName: text("actor_display_name").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    entityTitle: text("entity_title").notNull(),
    actionType: text("action_type").notNull(),
    details: jsonb("details").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("activity_events_entity_type_check", sql`${table.entityType} in ('task', 'event')`),
    check("activity_events_action_type_check", sql`${table.actionType} in ('created', 'completed', 'reopened', 'deleted', 'updated')`),
    index("activity_events_workspace_occurred_idx").on(table.workspaceId, table.occurredAt.desc(), table.id.desc()),
    index("activity_events_workspace_actor_occurred_idx").on(table.workspaceId, table.actorUserId, table.occurredAt.desc()),
  ],
);

export const activityReadStates = pgTable(
  "activity_read_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastSeenEventId: uuid("last_seen_event_id"),
    clearedThroughAt: timestamp("cleared_through_at", { withTimezone: true }),
    clearedThroughEventId: uuid("cleared_through_event_id"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("activity_read_states_workspace_user_unique").on(table.workspaceId, table.userId),
    index("activity_read_states_workspace_user_idx").on(table.workspaceId, table.userId),
  ],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    endpoint: text("endpoint").notNull(),
    p256dhKey: text("p256dh_key").notNull(),
    authKey: text("auth_key").notNull(),
    userAgent: text("user_agent"),
    enabled: boolean("enabled").notNull().default(true),
    lastSuccessfulDeliveryAt: timestamp("last_successful_delivery_at", { withTimezone: true }),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
    failureCount: integer("failure_count").notNull().default(0),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("push_subscriptions_endpoint_unique").on(table.endpoint),
    index("push_subscriptions_workspace_user_enabled_idx").on(table.workspaceId, table.userId, table.enabled),
    check("push_subscriptions_failure_count_check", sql`${table.failureCount} >= 0`),
  ],
);

export const nativePushDevices = pgTable(
  "native_push_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    deviceId: uuid("device_id").notNull(),
    expoPushToken: text("expo_push_token").notNull(),
    platform: text("platform").notNull().default("ios"),
    enabled: boolean("enabled").notNull().default(true),
    lastRegisteredAt: timestamp("last_registered_at", { withTimezone: true }).notNull().defaultNow(),
    lastSuccessfulDeliveryAt: timestamp("last_successful_delivery_at", { withTimezone: true }),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
    failureCount: integer("failure_count").notNull().default(0),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("native_push_devices_workspace_user_device_unique").on(table.workspaceId, table.userId, table.deviceId),
    uniqueIndex("native_push_devices_token_unique").on(table.expoPushToken),
    index("native_push_devices_workspace_user_enabled_idx").on(table.workspaceId, table.userId, table.enabled),
    check("native_push_devices_platform_check", sql`${table.platform} in ('ios')`),
    check("native_push_devices_failure_count_check", sql`${table.failureCount} >= 0`),
  ],
);

export const activityDigests = pgTable(
  "activity_digests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    recipientUserId: text("recipient_user_id").notNull(),
    digestDate: date("digest_date", { mode: "string" }).notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
    relevantActivityCount: integer("relevant_activity_count").notNull().default(0),
    assignedToRecipientCount: integer("assigned_to_recipient_count").notNull().default(0),
    status: text("status").notNull().default("processing"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("activity_digests_workspace_recipient_date_unique").on(table.workspaceId, table.recipientUserId, table.digestDate),
    index("activity_digests_date_status_idx").on(table.digestDate, table.status),
    check("activity_digests_status_check", sql`${table.status} in ('processing', 'no_activity', 'sent', 'partial', 'failed')`),
    check("activity_digests_activity_count_check", sql`${table.relevantActivityCount} >= 0`),
    check("activity_digests_assigned_count_check", sql`${table.assignedToRecipientCount} >= 0`),
    check("activity_digests_window_check", sql`${table.windowEnd} > ${table.windowStart}`),
  ],
);

export const activityDigestDeliveries = pgTable(
  "activity_digest_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    digestId: uuid("digest_id")
      .notNull()
      .references(() => activityDigests.id, { onDelete: "cascade" }),
    pushSubscriptionId: uuid("push_subscription_id")
      .notNull()
      .references(() => pushSubscriptions.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptedAt: timestamp("last_attempted_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("activity_digest_deliveries_digest_subscription_unique").on(table.digestId, table.pushSubscriptionId),
    index("activity_digest_deliveries_digest_status_idx").on(table.digestId, table.status),
    check("activity_digest_deliveries_status_check", sql`${table.status} in ('pending', 'processing', 'sent', 'expired', 'failed')`),
    check("activity_digest_deliveries_attempt_count_check", sql`${table.attemptCount} >= 0`),
  ],
);

export type WorkspaceRow = typeof workspaces.$inferSelect;
export type WorkspaceMemberRow = typeof workspaceMembers.$inferSelect;
export type TaskListRow = typeof taskLists.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type AgendaPreferenceRow = typeof agendaPreferences.$inferSelect;
export type AgendaItemRow = typeof agendaItems.$inferSelect;
export type ActivityEventRow = typeof activityEvents.$inferSelect;
export type ActivityReadStateRow = typeof activityReadStates.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type NativePushDeviceRow = typeof nativePushDevices.$inferSelect;
export type ActivityDigestRow = typeof activityDigests.$inferSelect;
export type ActivityDigestDeliveryRow = typeof activityDigestDeliveries.$inferSelect;
