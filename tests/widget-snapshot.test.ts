import { describe, expect, it } from "vitest";

import type { ApiCalendarData, ApiCategoriesData } from "@/lib/api/v1/contracts";
import { buildWidgetSnapshot, widgetSnapshotWindow } from "@/lib/api/v1/widget-snapshot";
import type { AgendaData } from "@/lib/types";

const taskId = "3344cc5f-bb0f-4c38-894d-a79122869f1d";
const eventId = "273ace7f-0633-45f7-b2e7-8c0056a60646";
const listId = "9da994c8-24b1-49ad-b7e7-cd7883816041";
const ownItemId = "ff294744-ae45-4b20-909d-b2dfca65b57e";
const partnerItemId = "9ded8c10-53ba-439c-9129-0ed6784b65a7";
const now = new Date("2026-08-15T17:00:00.000Z");

const categories: ApiCategoriesData = { categories: [{ id: listId, name: "Home", color: "#4E7BC4", position: 0 }] };
const calendar: ApiCalendarData = {
  workspaceTimezone: "America/Chicago",
  start: "2026-08-15",
  end: "2026-08-22",
  truncated: false,
  tasks: [{
    id: taskId,
    title: "Buy milk",
    notes: "private notes must not escape",
    dueAt: "2026-08-15T20:00:00.000Z",
    dueIsAllDay: false,
    assigneeUserId: "user-1",
    listId,
    priority: "high",
    completedAt: null,
    recurrence: null,
    createdAt: "2026-08-10T12:00:00.000Z",
    updatedAt: "2026-08-10T12:00:00.000Z",
  }],
  events: [{
    id: eventId,
    listId,
    title: "Dinner",
    description: "private description must not escape",
    location: "private location must not escape",
    startAt: "2026-08-15T23:00:00.000Z",
    endAt: "2026-08-16T01:00:00.000Z",
    allDay: false,
    color: "#4E7BC4",
    recurrence: null,
    createdAt: "2026-08-10T12:00:00.000Z",
    updatedAt: "2026-08-10T12:00:00.000Z",
  }],
};
const agenda: AgendaData = {
  currentUserId: "user-1",
  workspaceTimezone: "America/Chicago",
  today: "2026-08-15",
  agendas: [
    { ownerUserId: "user-1", displayName: "Nick", canEdit: true, isShared: false, days: [{ date: "2026-08-15", isYesterday: false, items: [{ id: ownItemId, content: "Own plan", date: "2026-08-15", position: 0, createdAt: now.toISOString(), updatedAt: now.toISOString() }] }] },
    { ownerUserId: "user-2", displayName: "Alex", canEdit: false, isShared: true, days: [{ date: "2026-08-15", isYesterday: false, items: [{ id: partnerItemId, content: "Partner private plan", date: "2026-08-15", position: 0, createdAt: now.toISOString(), updatedAt: now.toISOString() }] }] },
  ],
};

describe("widget snapshot", () => {
  it("is compact and omits notes, descriptions, locations, and partner My List rows", () => {
    const snapshot = buildWidgetSnapshot({ calendar, categories, agenda, now });
    expect(snapshot.nextUp).toHaveLength(1);
    expect(snapshot.today.myList).toEqual([{ id: ownItemId, title: "Own plan" }]);
    expect(JSON.stringify(snapshot)).not.toMatch(/private notes|private description|private location|Partner private plan/);
  });

  it("uses the workspace date and an eight-day bounded fetch window", () => {
    expect(widgetSnapshotWindow("America/Chicago", now)).toEqual({ start: "2026-08-15", end: "2026-08-22" });
  });
});
