import { addDays, format, startOfWeek } from "date-fns";

import { dateKey, localDate } from "@/lib/dates/timezone";
import type { TaskView } from "@/lib/types";

export type PlannerQuadrant = 1 | 2 | 3 | 4;
export type PlannerView = "week" | "matrix";

export const quadrantDetails: Record<PlannerQuadrant, { label: string; action: string; description: string }> = {
  1: { label: "Urgent + important", action: "Do", description: "Act soon" },
  2: { label: "Important, not urgent", action: "Schedule", description: "Protect time" },
  3: { label: "Urgent, not important", action: "Delegate", description: "Hand off thoughtfully" },
  4: { label: "Not urgent or important", action: "Eliminate", description: "Reconsider or remove" },
};

export function plannerWeekStart(date: string) {
  return dateKey(startOfWeek(localDate(date), { weekStartsOn: 1 }));
}

export function plannerWeekDays(weekStart: string) {
  return Array.from({ length: 7 }, (_, index) => dateKey(addDays(localDate(weekStart), index)));
}

export function plannerRollingDays(today: string, tasks: TaskView[]) {
  const yesterday = dateKey(addDays(localDate(today), -1));
  const hasUnfinishedYesterday = tasks.some((task) => task.scheduledDate === yesterday && !task.completedAt);
  return plannerWeekDays(hasUnfinishedYesterday ? yesterday : today);
}

export function shiftPlannerWeek(weekStart: string, amount: number) {
  return dateKey(addDays(localDate(weekStart), amount * 7));
}

export function plannerWeekLabel(weekStart: string) {
  const end = addDays(localDate(weekStart), 6);
  const start = localDate(weekStart);
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${format(start, "MMMM d")}–${format(end, "d, yyyy")}`;
  }
  if (start.getFullYear() === end.getFullYear()) return `${format(start, "MMM d")}–${format(end, "MMM d, yyyy")}`;
  return `${format(start, "MMM d, yyyy")}–${format(end, "MMM d, yyyy")}`;
}

export function sortPlannerTasks(tasks: TaskView[]) {
  return [...tasks].sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function tasksForSchedule(tasks: TaskView[], scheduledDate: string | null) {
  return sortPlannerTasks(tasks.filter((task) => task.scheduledDate === scheduledDate));
}

export function tasksForQuadrant(tasks: TaskView[], quadrant: PlannerQuadrant | null) {
  return sortPlannerTasks(tasks.filter((task) => task.quadrant === quadrant));
}

export function normalizePlannerPositions(tasks: TaskView[], predicate: (task: TaskView) => boolean) {
  const ordered = sortPlannerTasks(tasks.filter(predicate));
  const positions = new Map(ordered.map((task, index) => [task.id, index]));
  return tasks.map((task) => positions.has(task.id) ? { ...task, position: positions.get(task.id)! } : task);
}

export function moveTaskToSchedule(tasks: TaskView[], taskId: string, scheduledDate: string | null, beforeTaskId?: string) {
  const moving = tasks.find((task) => task.id === taskId);
  if (!moving) return tasks;
  const sourceDate = moving.scheduledDate;
  const destination = sortPlannerTasks(tasks.filter((task) => task.id !== taskId && task.scheduledDate === scheduledDate));
  const beforeIndex = beforeTaskId ? destination.findIndex((task) => task.id === beforeTaskId) : -1;
  destination.splice(beforeIndex >= 0 ? beforeIndex : destination.length, 0, { ...moving, scheduledDate });
  const destinationPositions = new Map(destination.map((task, index) => [task.id, index]));
  let next = tasks.map((task) => {
    const position = destinationPositions.get(task.id);
    if (task.id === taskId) return { ...task, scheduledDate, position: position ?? task.position };
    return position === undefined ? task : { ...task, position };
  });
  if (sourceDate !== scheduledDate) next = normalizePlannerPositions(next, (task) => task.scheduledDate === sourceDate);
  return next;
}

export function moveTaskToQuadrant(tasks: TaskView[], taskId: string, quadrant: PlannerQuadrant | null, beforeTaskId?: string) {
  const moving = tasks.find((task) => task.id === taskId);
  if (!moving) return tasks;
  const sourceQuadrant = moving.quadrant;
  const destination = sortPlannerTasks(tasks.filter((task) => task.id !== taskId && task.quadrant === quadrant));
  const beforeIndex = beforeTaskId ? destination.findIndex((task) => task.id === beforeTaskId) : -1;
  destination.splice(beforeIndex >= 0 ? beforeIndex : destination.length, 0, { ...moving, quadrant });
  const destinationPositions = new Map(destination.map((task, index) => [task.id, index]));
  let next = tasks.map((task) => {
    const position = destinationPositions.get(task.id);
    if (task.id === taskId) return { ...task, quadrant, position: position ?? task.position };
    return position === undefined ? task : { ...task, position };
  });
  if (sourceQuadrant !== quadrant) next = normalizePlannerPositions(next, (task) => task.quadrant === sourceQuadrant);
  return next;
}

export function changedPlannerTasks(before: TaskView[], after: TaskView[]) {
  const previous = new Map(before.map((task) => [task.id, task]));
  return after.filter((task) => {
    const old = previous.get(task.id);
    return old && (old.scheduledDate !== task.scheduledDate || old.quadrant !== task.quadrant || old.position !== task.position);
  }).map(({ id, scheduledDate, quadrant, position }) => ({ id, scheduledDate, quadrant, position }));
}
