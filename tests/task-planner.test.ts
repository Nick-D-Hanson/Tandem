import { describe, expect, it } from "vitest";

import { changedPlannerTasks, moveTaskToQuadrant, moveTaskToSchedule, plannerRollingDays, plannerWeekDays, plannerWeekLabel, plannerWeekStart } from "@/lib/tasks/planner";
import type { TaskView } from "@/lib/types";

function task(id: string, scheduledDate: string | null, position: number, quadrant: TaskView["quadrant"] = null): TaskView {
  return {
    id,
    title: `Task ${id}`,
    notes: null,
    scheduledDate,
    dueAt: "2026-09-25T05:00:00.000Z",
    dueIsAllDay: true,
    assigneeUserId: null,
    listId: null,
    priority: "none",
    quadrant,
    completedAt: null,
    recurrence: null,
    createdBy: "user-a",
    updatedBy: "user-a",
    position,
    createdAt: "2026-09-20T12:00:00.000Z",
    updatedAt: "2026-09-20T12:00:00.000Z",
  };
}

describe("weekly task planner", () => {
  it("uses Monday-through-Sunday weeks across month boundaries", () => {
    const start = plannerWeekStart("2026-10-01");
    expect(start).toBe("2026-09-28");
    expect(plannerWeekDays(start)).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(plannerWeekLabel(start)).toBe("Sep 28–Oct 4, 2026");
  });

  it("defaults to today and the following six days when yesterday is clear", () => {
    const completedYesterday = { ...task("done", "2026-09-24", 0), completedAt: "2026-09-24T18:00:00.000Z" };
    expect(plannerRollingDays("2026-09-25", [completedYesterday])).toEqual([
      "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01",
    ]);
  });

  it("keeps yesterday in the rolling window while it has unfinished tasks", () => {
    expect(plannerRollingDays("2026-09-25", [task("remaining", "2026-09-24", 0)])).toEqual([
      "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30",
    ]);
  });

  it("schedules a backlog task at an exact insertion point without changing its due date or quadrant", () => {
    const before = [task("a", "2026-09-28", 0, 1), task("b", "2026-09-28", 1, 2), task("c", null, 0, 3)];
    const after = moveTaskToSchedule(before, "c", "2026-09-28", "b");
    expect(after.filter((item) => item.scheduledDate === "2026-09-28").sort((a, b) => a.position - b.position).map((item) => item.id)).toEqual(["a", "c", "b"]);
    expect(after.find((item) => item.id === "c")).toMatchObject({ dueAt: before[2].dueAt, quadrant: 3, scheduledDate: "2026-09-28" });
  });

  it("moves a task between matrix quadrants without changing its schedule", () => {
    const before = [task("a", "2026-09-28", 0, 1), task("b", null, 0, 2)];
    const after = moveTaskToQuadrant(before, "a", 2, "b");
    expect(after.find((item) => item.id === "a")).toMatchObject({ scheduledDate: "2026-09-28", quadrant: 2, position: 0 });
    expect(changedPlannerTasks(before, after).map((item) => item.id).sort()).toEqual(["a", "b"]);
  });

  it("returns a scheduled task to backlog without clearing its deadline", () => {
    const before = [task("a", "2026-09-28", 0, 4)];
    const after = moveTaskToSchedule(before, "a", null);
    expect(after[0]).toMatchObject({ scheduledDate: null, dueAt: before[0].dueAt, quadrant: 4 });
  });
});
