import { z } from "zod";

const uuidSchema = z.uuid();
const isoTimestampSchema = z.iso.datetime({ offset: true });
const dateOnlySchema = z.iso.date();

export const apiErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
]);

export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string().min(1).max(200),
}).strict();

export const apiFailureSchema = z.object({
  ok: z.literal(false),
  error: apiErrorSchema,
}).strict();

export const apiMemberSchema = z.object({
  userId: z.string().min(1).max(200),
  displayName: z.string().min(1).max(120),
  avatarUrl: z.url().nullable(),
}).strict();

export const apiMeDataSchema = z.object({
  apiVersion: z.literal("v1"),
  generatedAt: isoTimestampSchema,
  user: z.object({
    id: z.string().min(1).max(200),
    email: z.email(),
    displayName: z.string().min(1).max(120),
    avatarUrl: z.url().nullable(),
  }).strict(),
  workspace: z.object({
    id: uuidSchema,
    name: z.string().min(1).max(120),
    timezone: z.string().min(1).max(100),
  }).strict(),
  members: z.array(apiMemberSchema).min(1).max(2),
}).strict();

export function apiSuccessSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({ ok: z.literal(true), data: dataSchema }).strict();
}

export const apiMeSuccessSchema = apiSuccessSchema(apiMeDataSchema);
export const apiMeResponseSchema = z.union([apiMeSuccessSchema, apiFailureSchema]);

export const apiCategorySchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(120),
  color: z.string().min(1).max(32),
  position: z.number().int().min(0),
}).strict();

export const apiRecurrenceSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval: z.number().int().min(1).max(99),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  until: dateOnlySchema.optional(),
}).strict();

export const apiTaskSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1).max(300),
  notes: z.string().nullable(),
  dueAt: isoTimestampSchema.nullable(),
  dueIsAllDay: z.boolean(),
  assigneeUserId: z.string().max(200).nullable(),
  listId: uuidSchema.nullable(),
  priority: z.enum(["none", "low", "medium", "high"]),
  completedAt: isoTimestampSchema.nullable(),
  recurrence: apiRecurrenceSchema.nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
}).strict();

export const apiEventSchema = z.object({
  id: uuidSchema,
  listId: uuidSchema.nullable(),
  title: z.string().min(1).max(300),
  description: z.string().nullable(),
  location: z.string().nullable(),
  startAt: isoTimestampSchema,
  endAt: isoTimestampSchema,
  allDay: z.boolean(),
  color: z.string().min(1).max(32),
  recurrence: apiRecurrenceSchema.nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
}).strict();

export const apiCategoriesDataSchema = z.object({
  categories: z.array(apiCategorySchema).max(100),
}).strict();

export const apiTasksDataSchema = z.object({
  tasks: z.array(apiTaskSchema).max(100),
  nextCursor: isoTimestampSchema.nullable(),
}).strict();

export const apiCalendarDataSchema = z.object({
  workspaceTimezone: z.string().min(1).max(100),
  start: dateOnlySchema,
  end: dateOnlySchema,
  tasks: z.array(apiTaskSchema).max(500),
  events: z.array(apiEventSchema).max(500),
  truncated: z.boolean(),
}).strict();

export const apiAgendaItemSchema = z.object({
  id: uuidSchema,
  content: z.string().min(1).max(300),
  date: dateOnlySchema,
  position: z.number().int().min(0),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
}).strict();

export const apiAgendaDataSchema = z.object({
  currentUserId: z.string().min(1).max(200),
  workspaceTimezone: z.string().min(1).max(100),
  today: dateOnlySchema,
  agendas: z.array(z.object({
    ownerUserId: z.string().min(1).max(200),
    displayName: z.string().min(1).max(120),
    canEdit: z.boolean(),
    isShared: z.boolean(),
    days: z.array(z.object({
      date: dateOnlySchema,
      items: z.array(apiAgendaItemSchema),
      isYesterday: z.boolean(),
    }).strict()).max(4),
  }).strict()).max(2),
}).strict();

export const apiActivityDataSchema = z.object({
  items: z.array(z.object({
    id: uuidSchema,
    actorUserId: z.string().min(1).max(200),
    actorDisplayName: z.string().min(1).max(120),
    entityType: z.enum(["task", "event"]),
    entityId: uuidSchema,
    entityTitle: z.string().min(1).max(300),
    actionType: z.enum(["created", "completed", "reopened", "deleted", "updated"]),
    details: z.unknown().nullable(),
    occurredAt: isoTimestampSchema,
  }).strict()).max(50),
  unreadCount: z.number().int().min(0),
  nextCursor: z.object({ occurredAt: isoTimestampSchema, id: uuidSchema }).strict().nullable(),
  workspaceTimezone: z.string().min(1).max(100),
  currentUserId: z.string().min(1).max(200),
}).strict();

export const apiCategoriesSuccessSchema = apiSuccessSchema(apiCategoriesDataSchema);
export const apiTasksSuccessSchema = apiSuccessSchema(apiTasksDataSchema);
export const apiCalendarSuccessSchema = apiSuccessSchema(apiCalendarDataSchema);
export const apiAgendaSuccessSchema = apiSuccessSchema(apiAgendaDataSchema);
export const apiActivitySuccessSchema = apiSuccessSchema(apiActivityDataSchema);

export const apiMoveDateBodySchema = z.object({ targetDate: dateOnlySchema }).strict();
export const apiTaskMoveDataSchema = z.object({
  id: uuidSchema,
  dueAt: isoTimestampSchema,
  dueIsAllDay: z.boolean(),
}).strict();
export const apiEventMoveDataSchema = z.object({
  id: uuidSchema,
  startAt: isoTimestampSchema,
  endAt: isoTimestampSchema,
  allDay: z.boolean(),
}).strict();
export const apiAgendaRolloverDataSchema = z.object({
  movedCount: z.number().int().min(1),
  today: dateOnlySchema,
}).strict();

export const apiTaskMoveSuccessSchema = apiSuccessSchema(apiTaskMoveDataSchema);
export const apiEventMoveSuccessSchema = apiSuccessSchema(apiEventMoveDataSchema);
export const apiAgendaRolloverSuccessSchema = apiSuccessSchema(apiAgendaRolloverDataSchema);

export const apiWidgetItemSchema = z.object({
  type: z.enum(["event", "task"]),
  id: uuidSchema,
  title: z.string().min(1).max(300),
  dateLabel: z.string().min(1).max(80),
  categoryColor: z.string().min(1).max(32),
  priority: z.enum(["None", "Low", "Medium", "High"]).nullable(),
}).strict();

export const apiWidgetMyListItemSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1).max(300),
}).strict();

export const apiWidgetSnapshotDataSchema = z.object({
  generatedAt: isoTimestampSchema,
  workspaceTimeZone: z.string().min(1).max(100),
  localDate: dateOnlySchema,
  nextUp: z.array(apiWidgetItemSchema).max(1),
  today: z.object({
    calendar: z.array(apiWidgetItemSchema).max(5),
    tasks: z.array(apiWidgetItemSchema).max(5),
    myList: z.array(apiWidgetMyListItemSchema).max(7),
  }).strict(),
  upcoming: z.array(apiWidgetItemSchema).max(5),
}).strict();

export const apiWidgetSnapshotSuccessSchema = apiSuccessSchema(apiWidgetSnapshotDataSchema);
export type ApiWidgetSnapshotData = z.infer<typeof apiWidgetSnapshotDataSchema>;

export const apiNativePushRegistrationBodySchema = z.object({
  deviceId: uuidSchema,
  platform: z.literal("ios"),
  expoPushToken: z.string().min(20).max(512).regex(/^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$/),
}).strict();
export const apiNativePushDisableBodySchema = z.object({ deviceId: uuidSchema }).strict();
export const apiNativePushDeviceDataSchema = z.object({
  id: uuidSchema,
  deviceId: uuidSchema,
  platform: z.literal("ios"),
  enabled: z.boolean(),
}).strict();
export const apiNativePushDeviceSuccessSchema = apiSuccessSchema(apiNativePushDeviceDataSchema);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiFailure = z.infer<typeof apiFailureSchema>;
export type ApiMeData = z.infer<typeof apiMeDataSchema>;
export type ApiMeResponse = z.infer<typeof apiMeResponseSchema>;
export type ApiCategory = z.infer<typeof apiCategorySchema>;
export type ApiTask = z.infer<typeof apiTaskSchema>;
export type ApiEvent = z.infer<typeof apiEventSchema>;
export type ApiCategoriesData = z.infer<typeof apiCategoriesDataSchema>;
export type ApiTasksData = z.infer<typeof apiTasksDataSchema>;
export type ApiCalendarData = z.infer<typeof apiCalendarDataSchema>;
