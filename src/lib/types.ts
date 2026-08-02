import type { RecurrenceRule } from "@/lib/recurrence";

export type MemberView = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
};

export type ListView = {
  id: string;
  name: string;
  color: string;
  position: number;
};

export type TaskView = {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string | null;
  dueIsAllDay: boolean;
  assigneeUserId: string | null;
  listId: string | null;
  priority: "none" | "low" | "medium" | "high";
  completedAt: string | null;
  recurrence: RecurrenceRule | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type EventView = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: "blue" | "violet" | "teal" | "amber" | "rose";
  recurrence: RecurrenceRule | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceView = {
  id: string;
  name: string;
  timezone: string;
  createdBy: string;
};

export type AppData = {
  workspace: WorkspaceView;
  currentUserId: string;
  members: MemberView[];
  lists: ListView[];
  tasks: TaskView[];
  events: EventView[];
};

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
