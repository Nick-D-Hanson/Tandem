import { describe, expect, it } from "vitest";

import { eventSchema, listSchema, taskSchema, workspaceSchema } from "@/lib/validation/schemas";

describe("mutation validation", () => {
  it("rejects an event whose end is before its start", () => {
    const result = eventSchema.safeParse({ title: "Dinner", date: "2026-08-02", endDate: "2026-08-02", allDay: false, startTime: "19:00", endTime: "18:00", listId: "", recurrence: null });
    expect(result.success).toBe(false);
  });

  it("accepts undated and unassigned tasks", () => {
    const result = taskSchema.safeParse({ title: "Replace filter", dueDate: "", dueTime: "", assigneeUserId: "", listId: "", priority: "low" });
    expect(result.success).toBe(true);
  });

  it("requires a due date for repeating tasks", () => {
    const result = taskSchema.safeParse({ title: "Water plants", dueDate: "", dueTime: "", assigneeUserId: "", listId: "", priority: "low", recurrence: { frequency: "weekly", interval: 1 } });
    expect(result.success).toBe(false);
  });

  it("rejects recurrence end dates before the first occurrence", () => {
    const result = eventSchema.safeParse({ title: "Birthday", date: "2026-08-02", endDate: "2026-08-02", allDay: true, listId: "", recurrence: { frequency: "yearly", interval: 1, until: "2025-08-02" } });
    expect(result.success).toBe(false);
  });

  it("accepts a multi-day event without times", () => {
    const result = eventSchema.safeParse({ title: "Vacation", date: "2026-08-02", endDate: "2026-08-08", allDay: true, listId: "", recurrence: null });
    expect(result.success).toBe(true);
  });

  it("rejects a multi-day event whose end date is before its start", () => {
    const result = eventSchema.safeParse({ title: "Trip", date: "2026-08-08", endDate: "2026-08-02", allDay: true, listId: "", recurrence: null });
    expect(result.success).toBe(false);
  });

  it("rejects invalid workspace and list values", () => {
    expect(workspaceSchema.safeParse({ name: "", timezone: "", displayName: "" }).success).toBe(false);
    expect(listSchema.safeParse({ name: "Home", color: "blue" }).success).toBe(false);
  });
});
