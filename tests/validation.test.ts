import { describe, expect, it } from "vitest";

import { eventSchema, listSchema, taskSchema, workspaceSchema } from "@/lib/validation/schemas";

describe("mutation validation", () => {
  it("rejects an event whose end is before its start", () => {
    const result = eventSchema.safeParse({ title: "Dinner", date: "2026-08-02", allDay: false, startTime: "19:00", endTime: "18:00", color: "blue", recurrence: "none" });
    expect(result.success).toBe(false);
  });

  it("accepts undated and unassigned tasks", () => {
    const result = taskSchema.safeParse({ title: "Replace filter", dueDate: "", dueTime: "", assigneeUserId: "", listId: "", priority: "low" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid workspace and list values", () => {
    expect(workspaceSchema.safeParse({ name: "", timezone: "", displayName: "" }).success).toBe(false);
    expect(listSchema.safeParse({ name: "Home", color: "blue" }).success).toBe(false);
  });
});
