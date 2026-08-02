import { asc, eq } from "drizzle-orm";

import { events, taskLists, tasks, workspaceMembers, workspaces } from "../../../db/schema";
import { requireWorkspace } from "@/lib/authorization";
import { db } from "@/lib/db/client";
import type { AppData, EventView, TaskView } from "@/lib/types";

export async function getAppData(): Promise<AppData> {
  const { user, membership } = await requireWorkspace();
  const workspaceId = membership.workspaceId;

  const [workspaceRows, memberRows, listRows, taskRows, eventRows] = await Promise.all([
    db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1),
    db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId)).orderBy(asc(workspaceMembers.joinedAt)),
    db.select().from(taskLists).where(eq(taskLists.workspaceId, workspaceId)).orderBy(asc(taskLists.position), asc(taskLists.name)),
    db.select().from(tasks).where(eq(tasks.workspaceId, workspaceId)).orderBy(asc(tasks.position), asc(tasks.createdAt)),
    db.select().from(events).where(eq(events.workspaceId, workspaceId)).orderBy(asc(events.startAt)),
  ]);

  const workspace = workspaceRows[0];
  if (!workspace) throw new Error("WORKSPACE_NOT_FOUND");

  return {
    workspace: { id: workspace.id, name: workspace.name, timezone: workspace.timezone, createdBy: workspace.createdBy },
    currentUserId: user.id,
    members: memberRows.map((member) => ({
      userId: member.userId,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl,
    })),
    lists: listRows.map((list) => ({ id: list.id, name: list.name, color: list.color, position: list.position })),
    tasks: taskRows.map((task): TaskView => ({
      id: task.id,
      title: task.title,
      notes: task.notes,
      dueAt: task.dueAt?.toISOString() ?? null,
      dueIsAllDay: task.dueIsAllDay,
      assigneeUserId: task.assigneeUserId,
      listId: task.listId,
      priority: task.priority as TaskView["priority"],
      completedAt: task.completedAt?.toISOString() ?? null,
      createdBy: task.createdBy,
      updatedBy: task.updatedBy,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })),
    events: eventRows.map((event): EventView => ({
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      startAt: event.startAt.toISOString(),
      endAt: event.endAt.toISOString(),
      allDay: event.allDay,
      color: event.color as EventView["color"],
      recurrence: (event.recurrence as EventView["recurrence"]) ?? null,
      createdBy: event.createdBy,
      updatedBy: event.updatedBy,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    })),
  };
}
