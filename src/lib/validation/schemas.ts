import { z } from "zod";

const uuid = z.uuid();
const optionalText = z.string().trim().max(2000).optional().or(z.literal(""));
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date");
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a valid time");
const recurrenceSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval: z.number().int().min(1).max(99),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  until: dateString.optional().or(z.literal("")),
}).nullable().default(null);

export const workspaceSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required").max(80),
  timezone: z.string().trim().min(1).max(100),
  displayName: z.string().trim().min(1, "Your name is required").max(80),
});

export const eventSchema = z
  .object({
    id: uuid.optional(),
    title: z.string().trim().min(1, "Title is required").max(120),
    date: dateString,
    endDate: dateString,
    allDay: z.boolean(),
    startTime: timeString.optional(),
    endTime: timeString.optional(),
    description: optionalText,
    location: z.string().trim().max(240).optional().or(z.literal("")),
    listId: uuid.optional().or(z.literal("")),
    recurrence: recurrenceSchema,
  })
  .superRefine((value, context) => {
    if (value.endDate < value.date) {
      context.addIssue({ code: "custom", message: "End date cannot be before start date", path: ["endDate"] });
    }
    if (!value.allDay && (!value.startTime || !value.endTime)) {
      context.addIssue({ code: "custom", message: "Start and end times are required", path: ["startTime"] });
    }
    if (!value.allDay && value.date === value.endDate && value.startTime && value.endTime && value.endTime <= value.startTime) {
      context.addIssue({ code: "custom", message: "End time must be after start time", path: ["endTime"] });
    }
    if (value.recurrence?.until && value.recurrence.until < value.date) {
      context.addIssue({ code: "custom", message: "Repeat end date cannot be before the event", path: ["recurrence"] });
    }
  });

export const taskSchema = z.object({
  id: uuid.optional(),
  title: z.string().trim().min(1, "Title is required").max(120),
  notes: optionalText,
  dueDate: dateString.optional().or(z.literal("")),
  dueTime: timeString.optional().or(z.literal("")),
  assigneeUserId: z.string().trim().max(255).optional().or(z.literal("")),
  listId: uuid.optional().or(z.literal("")),
  priority: z.enum(["none", "low", "medium", "high"]),
  recurrence: recurrenceSchema,
}).superRefine((value, context) => {
  if (value.recurrence && !value.dueDate) context.addIssue({ code: "custom", message: "A repeating task needs a due date", path: ["dueDate"] });
  if (value.recurrence?.until && value.dueDate && value.recurrence.until < value.dueDate) context.addIssue({ code: "custom", message: "Repeat end date cannot be before the due date", path: ["recurrence"] });
});

export const listSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, "List name is required").max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Choose a valid color"),
});

export const idSchema = z.object({ id: uuid });
export const inviteTokenSchema = z.object({ token: z.string().min(40).max(200) });

export type EventInput = z.infer<typeof eventSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
export type ListInput = z.infer<typeof listSchema>;
