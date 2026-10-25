import { describe, expect, it } from "vitest";

import type { EventRow, TaskRow } from "../db/schema";
import { buildEventCreated, buildEventDeleted, buildEventUpdated, buildTaskCreated, buildTaskDeleted, buildTaskStateChange, buildTaskUpdated, eventDateLabel } from "@/lib/activity/build-event";
import { activityDetailsSchema } from "@/lib/activity/schema";

const context = {
  timezone: "America/Chicago",
  categories: new Map([["2f8fcb8a-4adb-4c66-8e91-a91cf7ff5d63", "Home"], ["3f8fcb8a-4adb-4c66-8e91-a91cf7ff5d64", "Work"]]),
  members: new Map([["user-a", "Alex"], ["user-b", "Jamie"]]),
};

function task(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: "4f8fcb8a-4adb-4c66-8e91-a91cf7ff5d65",
    workspaceId: "5f8fcb8a-4adb-4c66-8e91-a91cf7ff5d66",
    listId: null,
    title: "Book hotel",
    notes: null,
    scheduledDate: null,
    dueAt: new Date("2026-08-10T05:00:00.000Z"),
    dueIsAllDay: true,
    assigneeUserId: null,
    priority: "none",
    quadrant: null,
    completedAt: null,
    recurrence: null,
    position: 0,
    createdBy: "user-a",
    updatedBy: "user-a",
    createdAt: new Date("2026-08-04T12:00:00.000Z"),
    updatedAt: new Date("2026-08-04T12:00:00.000Z"),
    ...overrides,
  };
}

function event(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "6f8fcb8a-4adb-4c66-8e91-a91cf7ff5d67",
    workspaceId: "5f8fcb8a-4adb-4c66-8e91-a91cf7ff5d66",
    listId: null,
    title: "Family trip",
    description: null,
    location: null,
    startAt: new Date("2026-08-10T05:00:00.000Z"),
    endAt: new Date("2026-08-13T05:00:00.000Z"),
    allDay: true,
    color: "#64748b",
    recurrence: null,
    createdBy: "user-a",
    updatedBy: "user-a",
    createdAt: new Date("2026-08-04T12:00:00.000Z"),
    updatedAt: new Date("2026-08-04T12:00:00.000Z"),
    ...overrides,
  };
}

describe("activity ledger semantics", () => {
  it("creates one versioned Task event with actor-independent snapshots", () => {
    const draft = buildTaskCreated(task({ assigneeUserId: "user-b" }), context);
    expect(draft.actionType).toBe("created");
    expect(draft.details.snapshot.assigneeName).toBe("Jamie");
    expect(draft.details.changes).toEqual([]);
    expect(activityDetailsSchema.safeParse(draft.details).success).toBe(true);
  });

  it("combines all tracked Task changes into one update", () => {
    const before = task({ listId: "2f8fcb8a-4adb-4c66-8e91-a91cf7ff5d63", priority: "medium", assigneeUserId: "user-a" });
    const after = task({
      title: "Book the hotel",
      dueAt: new Date("2026-08-11T05:00:00.000Z"),
      listId: "3f8fcb8a-4adb-4c66-8e91-a91cf7ff5d64",
      priority: "high",
      assigneeUserId: "user-b",
    });
    const draft = buildTaskUpdated(before, after, context);
    expect(draft?.entityTitle).toBe("Book the hotel");
    expect(draft?.details.changes.map((change) => change.field)).toEqual(["date", "category", "priority", "assignee"]);
  });

  it("does not create activity for no-op or untracked-only Task updates", () => {
    const before = task();
    expect(buildTaskUpdated(before, { ...before, updatedAt: new Date() }, context)).toBeNull();
    expect(buildTaskUpdated(before, { ...before, title: "Renamed", notes: "New notes" }, context)).toBeNull();
  });

  it("records completion, reopening, and a recurring next-date transition", () => {
    const advanced = task({ dueAt: new Date("2026-08-17T05:00:00.000Z"), recurrence: "weekly" });
    const completed = buildTaskStateChange(advanced, context, "completed", new Date("2026-08-10T05:00:00.000Z"));
    expect(completed.actionType).toBe("completed");
    expect(completed.details.changes).toHaveLength(1);
    expect(buildTaskStateChange(task(), context, "reopened").actionType).toBe("reopened");
  });

  it("preserves Task and Event snapshots for deletion rendering", () => {
    const deletedTask = buildTaskDeleted(task({ listId: "2f8fcb8a-4adb-4c66-8e91-a91cf7ff5d63" }), context);
    const deletedEvent = buildEventDeleted(event(), context);
    expect(deletedTask.details.snapshot.categoryName).toBe("Home");
    expect(deletedEvent.entityTitle).toBe("Family trip");
  });

  it("stores inclusive local dates for all-day Events", () => {
    expect(eventDateLabel(event(), "America/Chicago")).toBe("Aug 10–Aug 12");
    expect(buildEventCreated(event(), context).details.snapshot.dateLabel).toBe("Aug 10–Aug 12");
  });

  it("records one Event date/category update and ignores title-only changes", () => {
    const before = event({ listId: "2f8fcb8a-4adb-4c66-8e91-a91cf7ff5d63" });
    const after = event({ startAt: new Date("2026-08-11T05:00:00.000Z"), endAt: new Date("2026-08-14T05:00:00.000Z"), listId: null });
    expect(buildEventUpdated(before, after, context)?.details.changes.map((change) => change.field)).toEqual(["date", "category"]);
    expect(buildEventUpdated(before, { ...before, title: "Renamed", description: "Notes" }, context)).toBeNull();
  });

  it("marks recurring Event updates and removals as series activity", () => {
    const recurring = event({ recurrence: "yearly" });
    const updated = buildEventUpdated(recurring, { ...recurring, listId: "2f8fcb8a-4adb-4c66-8e91-a91cf7ff5d63" }, context);
    expect(updated?.details.snapshot.isRecurringSeries).toBe(true);
    expect(buildEventDeleted(recurring, context).details.snapshot.isRecurringSeries).toBe(true);
  });
});
