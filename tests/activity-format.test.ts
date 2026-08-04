import { describe, expect, it } from "vitest";

import { activityDayKey, activityDayLabel, activitySentence, mergeActivityItems } from "@/lib/activity/format";
import type { ActivityItemView } from "@/lib/activity/types";

function item(overrides: Partial<ActivityItemView> = {}): ActivityItemView {
  return {
    id: "7f8fcb8a-4adb-4c66-8e91-a91cf7ff5d68",
    actorUserId: "user-a",
    actorDisplayName: "Alex",
    entityType: "task",
    entityId: "8f8fcb8a-4adb-4c66-8e91-a91cf7ff5d69",
    entityTitle: "Call landlord",
    actionType: "updated",
    occurredAt: "2026-08-05T00:30:00.000Z",
    details: {
      version: 1,
      changes: [{ field: "assignee", before: { value: null, label: "Unassigned" }, after: { value: "user-b", label: "Jamie" } }],
      snapshot: { dateLabel: null, categoryId: null, categoryName: null, priority: "high", assigneeUserId: "user-b", assigneeName: "Jamie", isRecurringSeries: false },
    },
    ...overrides,
  };
}

describe("Activity Summary formatting", () => {
  it("uses viewer-relative assignment copy", () => {
    expect(activitySentence(item(), "user-b")).toContain("assignee to you");
    expect(activitySentence(item(), "user-c")).toContain("assignee to Jamie");
  });

  it("renders recurring Event series removal explicitly", () => {
    const removed = item({ entityType: "event", entityTitle: "Family dinner", actionType: "deleted", details: { ...item().details!, snapshot: { ...item().details!.snapshot, isRecurringSeries: true, priority: null } } });
    expect(activitySentence(removed, "user-b")).toBe("Alex removed recurring Event series ‘Family dinner’.");
  });

  it("falls back safely when historical details are invalid or unknown", () => {
    expect(activitySentence(item({ details: null }), "user-b")).toBe("Alex updated Task ‘Call landlord’.");
  });

  it("groups timestamps by workspace-local dates across UTC boundaries", () => {
    expect(activityDayKey("2026-08-05T00:30:00.000Z", "America/Chicago")).toBe("2026-08-04");
    expect(activityDayLabel("2026-08-04", "America/Chicago", new Date("2026-08-05T03:00:00.000Z"))).toBe("Today");
  });

  it("merges cursor pages without duplicates and preserves order", () => {
    const first = item();
    const second = item({ id: "9f8fcb8a-4adb-4c66-8e91-a91cf7ff5d60" });
    expect(mergeActivityItems([first], [first, second]).map((entry) => entry.id)).toEqual([first.id, second.id]);
  });
});
