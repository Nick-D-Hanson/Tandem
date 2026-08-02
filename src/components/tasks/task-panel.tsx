"use client";

import { CheckCircle2, CircleAlert, ListTodo, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toggleTaskAction } from "@/lib/actions/items";
import { dateKey, localDate, utcToLocalParts, zonedNow } from "@/lib/dates/timezone";
import type { ListView, MemberView, TaskView } from "@/lib/types";
import { cn } from "@/lib/utils";

export type TaskFilter = "all" | "inbox" | "today" | "upcoming" | "completed" | `list:${string}`;

export function TaskPanel({ tasks: serverTasks, lists, members, timezone, filter, onEdit, onAdd, className }: {
  tasks: TaskView[];
  lists: ListView[];
  members: MemberView[];
  timezone: string;
  filter: TaskFilter;
  onEdit: (id: string) => void;
  onAdd: () => void;
  className?: string;
}) {
  const [completionOverrides, setCompletionOverrides] = useState<Record<string, string | null>>({});
  const tasks = serverTasks.map((task) => Object.hasOwn(completionOverrides, task.id) ? { ...task, completedAt: completionOverrides[task.id] } : task);
  const today = dateKey(zonedNow(timezone));

  async function toggle(task: TaskView, completed: boolean) {
    setCompletionOverrides((current) => ({ ...current, [task.id]: completed ? new Date().toISOString() : null }));
    const result = await toggleTaskAction({ id: task.id, completed });
    if (!result.ok) {
      setCompletionOverrides((current) => {
        const next = { ...current };
        delete next[task.id];
        return next;
      });
      toast.error(result.error);
    } else {
      toast.success(completed ? "Task completed" : "Task reopened", { description: task.title });
    }
  }

  const filtered = useMemo(() => tasks.filter((task) => {
    const dueDate = task.dueAt ? utcToLocalParts(task.dueAt, timezone).date : null;
    if (filter === "completed") return Boolean(task.completedAt);
    if (task.completedAt) return filter === "all";
    if (filter === "today") return dueDate === today;
    if (filter === "upcoming") return Boolean(dueDate && dueDate > today);
    if (filter === "inbox") return !task.listId;
    if (filter.startsWith("list:")) return task.listId === filter.slice(5);
    return true;
  }), [tasks, filter, timezone, today]);

  const sections = filter === "all" ? buildSections(filtered, timezone, today) : [{ title: filterLabel(filter, lists), tasks: filtered }];

  return (
    <aside className={cn("flex min-h-0 flex-col overflow-hidden border-l bg-card/95", className)} aria-label="Task agenda" data-testid="task-panel">
      <header className="flex min-h-[62px] items-center border-b px-3.5"><div><h2 className="font-semibold tracking-tight">Tasks</h2><p className="text-xs text-muted-foreground">Shared work, one place</p></div></header>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full"><div className="space-y-5 p-3 pb-24">
          {filtered.length === 0 && <div className="grid place-items-center gap-2 py-16 text-center text-muted-foreground"><ListTodo className="size-9" /><p className="text-sm font-medium">Nothing here yet</p><p className="max-w-52 text-xs">Add a shared task or choose another view.</p></div>}
          {sections.map((section) => section.tasks.length > 0 && <TaskSection key={section.title} title={section.title} tasks={section.tasks} lists={lists} members={members} timezone={timezone} onEdit={onEdit} onToggle={toggle} />)}
        </div></ScrollArea>
        <Button className="absolute bottom-4 right-4 shadow-lg" onClick={onAdd}><Plus />New task</Button>
      </div>
    </aside>
  );
}

function buildSections(tasks: TaskView[], timezone: string, today: string) {
  const open = tasks.filter((task) => !task.completedAt);
  const due = (task: TaskView) => task.dueAt ? utcToLocalParts(task.dueAt, timezone).date : null;
  return [
    { title: "Overdue", tasks: open.filter((task) => due(task) && due(task)! < today) },
    { title: "Today", tasks: open.filter((task) => due(task) === today) },
    { title: "Upcoming", tasks: open.filter((task) => due(task) && due(task)! > today).sort((a, b) => (a.dueAt || "").localeCompare(b.dueAt || "")) },
    { title: "Anytime", tasks: open.filter((task) => !task.dueAt) },
    { title: "Recently completed", tasks: tasks.filter((task) => task.completedAt).sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || "")).slice(0, 6) },
  ];
}

function filterLabel(filter: TaskFilter, lists: ListView[]) {
  if (filter.startsWith("list:")) return lists.find((list) => list.id === filter.slice(5))?.name ?? "List";
  const labels: Record<Exclude<TaskFilter, `list:${string}`>, string> = { all: "All tasks", inbox: "Inbox", today: "Today", upcoming: "Upcoming", completed: "Completed" };
  return labels[filter as Exclude<TaskFilter, `list:${string}`>];
}

function TaskSection({ title, tasks, lists, members, timezone, onEdit, onToggle }: {
  title: string;
  tasks: TaskView[];
  lists: ListView[];
  members: MemberView[];
  timezone: string;
  onEdit: (id: string) => void;
  onToggle: (task: TaskView, completed: boolean) => void;
}) {
  return <section><div className="mb-1.5 flex items-center justify-between px-1 text-xs font-bold"><span className="flex items-center gap-1.5">{title === "Overdue" && <CircleAlert className="size-3.5 text-destructive" />}{title === "Recently completed" && <CheckCircle2 className="size-3.5 text-success" />}{title}</span><span className="font-normal text-muted-foreground">{tasks.length}</span></div><div className="grid gap-1">{tasks.map((task) => <TaskRow key={task.id} task={task} list={lists.find((list) => list.id === task.listId)} member={members.find((member) => member.userId === task.assigneeUserId)} timezone={timezone} onEdit={onEdit} onToggle={onToggle} />)}</div></section>;
}

function TaskRow({ task, list, member, timezone, onEdit, onToggle }: { task: TaskView; list?: ListView; member?: MemberView; timezone: string; onEdit: (id: string) => void; onToggle: (task: TaskView, completed: boolean) => void }) {
  const due = task.dueAt ? utcToLocalParts(task.dueAt, timezone) : null;
  const dueLabel = due ? formatDueDate(due.date, due.time, task.dueIsAllDay, dateKey(zonedNow(timezone))) : list?.name ?? "Inbox";
  return <div role="button" tabIndex={0} onClick={() => onEdit(task.id)} onKeyDown={(event) => { if (event.key === "Enter") onEdit(task.id); }} className="grid cursor-pointer grid-cols-[22px_1fr_auto] items-start gap-2 rounded-lg border border-transparent p-2 hover:border-border hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={`task-${task.id}`}>
    <Checkbox checked={Boolean(task.completedAt)} onCheckedChange={(checked) => onToggle(task, Boolean(checked))} onClick={(event) => event.stopPropagation()} aria-label={`${task.completedAt ? "Reopen" : "Complete"} ${task.title}`} className="mt-0.5" />
    <div className="min-w-0"><div className={cn("truncate text-sm font-medium", task.completedAt && "text-muted-foreground line-through")}>{task.title}</div><div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground"><span>{dueLabel}</span>{due && list && <span>• {list.name}</span>}</div></div>
    <div className="flex items-center gap-1.5"><span className={cn("h-6 w-[3px] rounded-full", task.priority === "high" && "bg-red-500", task.priority === "medium" && "bg-amber-500", task.priority === "low" && "bg-blue-400")} />{member && <span title={member.displayName} className="grid size-6 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">{initials(member.displayName)}</span>}</div>
  </div>;
}

function formatDueDate(date: string, time: string, allDay: boolean, today: string) {
  if (date === today) return allDay ? "Today" : `Today · ${formatClock(time)}`;
  return `${new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(localDate(date))}${allDay ? "" : ` · ${formatClock(time)}`}`;
}

function formatClock(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, hour, minute));
}

export function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
