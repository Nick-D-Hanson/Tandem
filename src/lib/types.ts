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
  listId: string | null;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: string;
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

export type AgendaItemView = {
  id: string;
  content: string;
  date: string;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type AgendaDayView = {
  date: string;
  items: AgendaItemView[];
  isYesterday: boolean;
};

export type AgendaOwnerView = {
  ownerUserId: string;
  displayName: string;
  canEdit: boolean;
  visibleDays: 1 | 2 | 3;
  isShared: boolean;
  days: AgendaDayView[];
};

export type AgendaData = {
  currentUserId: string;
  workspaceTimezone: string;
  today: string;
  agendas: AgendaOwnerView[];
};

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
