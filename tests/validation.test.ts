import { describe, expect, it } from "vitest";

import { agendaItemCreateSchema, agendaReorderSchema, agendaVisibilitySchema, agendaVisibleDaysSchema, eventSchema, listSchema, taskSchema, workspaceSchema } from "@/lib/validation/schemas";

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

  it("accepts the supported Agenda preferences", () => {
    expect(agendaVisibleDaysSchema.safeParse({ visibleDays: 3 }).success).toBe(true);
    expect(agendaVisibleDaysSchema.safeParse({ visibleDays: 4 }).success).toBe(false);
    expect(agendaVisibilitySchema.safeParse({ visibility: "private" }).success).toBe(true);
    expect(agendaVisibilitySchema.safeParse({ visibility: "workspace" }).success).toBe(false);
  });

  it("trims Agenda content and enforces its length", () => {
    const parsed = agendaItemCreateSchema.safeParse({ date: "2026-08-02", content: "  Call Mom  " });
    expect(parsed.success && parsed.data.content).toBe("Call Mom");
    expect(agendaItemCreateSchema.safeParse({ date: "2026-08-02", content: "   " }).success).toBe(false);
    expect(agendaItemCreateSchema.safeParse({ date: "2026-08-02", content: "x".repeat(301) }).success).toBe(false);
  });

  it("rejects duplicate Agenda dates and item IDs in reorder payloads", () => {
    const id = "2f8fcb8a-4adb-4c66-8e91-a91cf7ff5d63";
    expect(agendaReorderSchema.safeParse({ days: [{ date: "2026-08-02", itemIds: [id] }, { date: "2026-08-03", itemIds: [id] }] }).success).toBe(false);
    expect(agendaReorderSchema.safeParse({ days: [{ date: "2026-08-02", itemIds: [] }, { date: "2026-08-02", itemIds: [] }] }).success).toBe(false);
  });
});
