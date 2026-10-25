import { describe, expect, it } from "vitest";

import { eventSchema, listSchema, plannerTaskOrderSchema, pushEndpointSchema, pushSubscriptionSchema, taskSchema, workspaceSchema } from "@/lib/validation/schemas";

describe("mutation validation", () => {
  it("rejects an event whose end is before its start", () => {
    const result = eventSchema.safeParse({ title: "Dinner", date: "2026-08-02", endDate: "2026-08-02", allDay: false, startTime: "19:00", endTime: "18:00", listId: "", recurrence: null });
    expect(result.success).toBe(false);
  });

  it("accepts undated and unassigned tasks", () => {
    const result = taskSchema.safeParse({ title: "Replace filter", dueDate: "", dueTime: "", assigneeUserId: "", listId: "", priority: "low" });
    expect(result.success).toBe(true);
  });

  it("keeps planned work, deadlines, and matrix priority independent", () => {
    const result = taskSchema.safeParse({ title: "Draft proposal", scheduledDate: "2026-09-22", dueDate: "2026-09-25", dueTime: "", assigneeUserId: "", listId: "", priority: "none", quadrant: 2 });
    expect(result.success).toBe(true);
  });

  it("validates persisted planner ordering without duplicate task IDs", () => {
    const update = { id: "2f8fcb8a-4adb-4c66-8e91-a91cf7ff5d63", scheduledDate: null, quadrant: 1 as const, position: 0 };
    expect(plannerTaskOrderSchema.safeParse({ tasks: [update] }).success).toBe(true);
    expect(plannerTaskOrderSchema.safeParse({ tasks: [update, update] }).success).toBe(false);
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
    const result = eventSchema.safeParse({ title: "Vacation", date: "2026-08-02", endDate: "2026-08-08", allDay: true, startTime: "", endTime: "", listId: "", recurrence: null });
    expect(result.success).toBe(true);
  });

  it("accepts a multi-day event with start and end times", () => {
    const result = eventSchema.safeParse({ title: "Conference", date: "2026-08-02", endDate: "2026-08-04", allDay: false, startTime: "09:00", endTime: "17:00", listId: "", recurrence: null });
    expect(result.success).toBe(true);
  });

  it("requires event start and end times to be entered together", () => {
    const result = eventSchema.safeParse({ title: "Dinner", date: "2026-08-02", endDate: "2026-08-02", allDay: false, startTime: "19:00", endTime: "", listId: "", recurrence: null });
    expect(result.success).toBe(false);
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

describe("push subscription validation", () => {
  const validSubscription = {
    endpoint: "https://push.example.test/subscriptions/device-token",
    expirationTime: null,
    keys: { p256dh: "p".repeat(32), auth: "a".repeat(16) },
  };

  it("accepts the browser PushSubscription JSON shape", () => {
    expect(pushSubscriptionSchema.safeParse(validSubscription).success).toBe(true);
    expect(pushEndpointSchema.safeParse({ endpoint: validSubscription.endpoint }).success).toBe(true);
  });

  it("rejects malformed endpoints and incomplete key material", () => {
    expect(pushSubscriptionSchema.safeParse({ ...validSubscription, endpoint: "not a URL" }).success).toBe(false);
    expect(pushSubscriptionSchema.safeParse({ ...validSubscription, keys: { p256dh: "short", auth: "short" } }).success).toBe(false);
  });
});
