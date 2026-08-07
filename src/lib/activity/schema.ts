import { z } from "zod";

export const activityEntityTypeSchema = z.enum(["task", "event"]);
export const activityActionTypeSchema = z.enum(["created", "completed", "reopened", "deleted", "updated"]);
export const activityFieldSchema = z.enum(["date", "category", "priority", "assignee"]);

const activityValueSchema = z.object({
  value: z.string().nullable(),
  label: z.string().nullable(),
});

export const activityDetailsSchema = z.object({
  version: z.literal(1),
  changes: z.array(z.object({
    field: activityFieldSchema,
    before: activityValueSchema,
    after: activityValueSchema,
  })),
  snapshot: z.object({
    dateLabel: z.string().nullable(),
    categoryId: z.string().uuid().nullable(),
    categoryName: z.string().nullable(),
    priority: z.enum(["none", "low", "medium", "high"]).nullable(),
    assigneeUserId: z.string().nullable(),
    assigneeName: z.string().nullable(),
    isRecurringSeries: z.boolean(),
  }),
});

export const activityCursorSchema = z.object({
  occurredAt: z.iso.datetime(),
  id: z.uuid(),
});

export const activitySeenSchema = z.object({ id: z.uuid() });

export type ActivityEntityType = z.infer<typeof activityEntityTypeSchema>;
export type ActivityActionType = z.infer<typeof activityActionTypeSchema>;
export type ActivityField = z.infer<typeof activityFieldSchema>;
export type ActivityDetails = z.infer<typeof activityDetailsSchema>;
export type ActivityChange = ActivityDetails["changes"][number];
