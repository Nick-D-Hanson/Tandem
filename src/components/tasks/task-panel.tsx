"use client";

import { CheckCircle2, ChevronDown, ChevronUp, CircleAlert, Flag, ListTodo, PanelRightClose, Plus, Repeat2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { ItemHoverDetails } from "@/components/items/item-hover-details";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toggleTaskAction } from "@/lib/actions/items";
import { dateKey, localDate, utcToLocalParts, zonedNow } from "@/lib/dates/timezone";
import { recurrenceLabel } from "@/lib/recurrence";
import type { ListView, MemberView, TaskView } from "@/lib/types";
import { cn } from "@/lib/utils";

export type TaskFilter = "all" | "inbox" | "today" | "upcoming" | "completed" | `list:${string}`;
type TaskGrouping = "creator" | "category";
type TaskSectionData = { key: string; title: string; tasks: TaskView[]; color?: string };

export function TaskPanel({ tasks: serverTasks, lists, members, timezone, filter, onEdit, onAdd, onClose, className }: {
  tasks: TaskView[];
  lists: ListView[];
  members: MemberView[];
  timezone: string;
  filter: TaskFilter;
  onEdit: (id: string) => void;
  onAdd: () => void;
  onClose?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [completionOverrides, setCompletionOverrides] = useState<Record<string, string | null>>({});
  const [grouping, setGrouping] = useState<TaskGrouping>("category");
  const [creatorId, setCreatorId] = useState<"all" | string>("all");
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
      if (result.data.advanced) {
        setCompletionOverrides((current) => {
          const next = { ...current };
          delete next[task.id];
          return next;
        });
        toast.success("Task moved to its next occurrence", { description: task.title });
        router.refresh();
      } else {
        toast.success(completed ? "Task completed" : "Task reopened", { description: task.title });
      }
    }
  }

  const filtered = useMemo(() => tasks.filter((task) => {
    const dueDate = task.dueAt ? utcToLocalParts(task.dueAt, timezone).date : null;
    if (filter === "completed") return Boolean(task.completedAt);
    if (task.completedAt) return false;
    if (filter === "today") return dueDate === today;
    if (filter === "upcoming") return Boolean(dueDate && dueDate > today);
    if (filter === "inbox") return !task.listId;
    if (filter.startsWith("list:")) return task.listId === filter.slice(5);
    return true;
  }), [tasks, filter, timezone, today]);

  const visibleTasks = grouping === "creator" && creatorId !== "all" ? filtered.filter((task) => task.createdBy === creatorId) : filtered;
  const sections = grouping === "creator" ? buildCreatorSections(visibleTasks, members, timezone, today) : buildCategorySections(visibleTasks, lists, timezone, today);

  return (
    <aside className={cn("flex min-h-0 flex-col overflow-hidden border-l bg-card/95", className)} aria-label="Task agenda" data-testid="task-panel">
      <header className="grid gap-2 border-b p-3"><div className="flex items-start justify-between gap-2"><div><h2 className="font-semibold tracking-tight">Tasks</h2><p className="text-xs text-muted-foreground">{taskViewLabel(filter, lists)}</p></div><div className="flex items-center gap-1"><ToggleGroup type="single" value={grouping} onValueChange={(value) => value && setGrouping(value as TaskGrouping)} variant="outline" size="sm" spacing={0} aria-label="Group tasks by"><ToggleGroupItem value="category" className="h-7 px-2 text-xs">Category</ToggleGroupItem><ToggleGroupItem value="creator" className="h-7 px-2 text-xs">Creator</ToggleGroupItem></ToggleGroup>{onClose && <Button variant="ghost" size="icon-sm" aria-label="Hide tasks sidebar" onClick={onClose}><PanelRightClose /></Button>}</div></div>{grouping === "creator" && <div className="flex flex-wrap gap-1" role="group" aria-label="Filter tasks by creator"><Button type="button" size="sm" variant={creatorId === "all" ? "default" : "outline"} className="h-7 px-2.5 text-xs" onClick={() => setCreatorId("all")}>All creators</Button>{members.map((member) => <Button key={member.userId} type="button" size="sm" variant={creatorId === member.userId ? "default" : "outline"} className="h-7 min-w-0 px-2.5 text-xs" onClick={() => setCreatorId(member.userId)}><span className="grid size-4 shrink-0 place-items-center rounded-full bg-background/20 text-[8px] font-bold">{initials(member.displayName)}</span><span className="max-w-20 truncate">{member.displayName}</span></Button>)}</div>}</header>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full"><div className="space-y-5 p-3 pb-24">
          {visibleTasks.length === 0 && <div className="grid place-items-center gap-2 py-16 text-center text-muted-foreground"><ListTodo className="size-9" /><p className="text-sm font-medium">Nothing here yet</p><p className="max-w-52 text-xs">Add a shared task or choose another view.</p></div>}
          {sections.map((section) => section.tasks.length > 0 && <TaskSection key={section.key} title={section.title} color={section.color} tasks={section.tasks} lists={lists} members={members} timezone={timezone} collapseOverflow={grouping === "category"} onEdit={onEdit} onToggle={toggle} />)}
        </div></ScrollArea>
        <Button className="absolute bottom-4 right-4 shadow-lg" onClick={onAdd}><Plus />New task</Button>
      </div>
    </aside>
  );
}

function taskViewLabel(filter: TaskFilter, lists: ListView[]) {
  if (filter.startsWith("list:")) return lists.find((list) => list.id === filter.slice(5))?.name ?? "Category";
  if (filter === "all") return "All incomplete";
  if (filter === "inbox") return "Inbox";
  if (filter === "today") return "Today";
  if (filter === "upcoming") return "Upcoming";
  return "Completed";
}

function sortTasks(tasks: TaskView[], timezone: string, today: string) {
  const priorityRank = { high: 0, medium: 1, low: 2, none: 3 } as const;
  const due = (task: TaskView) => task.dueAt ? utcToLocalParts(task.dueAt, timezone).date : null;
  const rank = (task: TaskView) => {
    if (task.completedAt) return 4;
    const date = due(task);
    if (date && date < today) return 0;
    if (date === today) return 1;
    if (date) return 2;
    return 3;
  };
  return [...tasks].sort((a, b) => rank(a) - rank(b) || (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999") || priorityRank[a.priority] - priorityRank[b.priority] || a.createdAt.localeCompare(b.createdAt));
}

function buildCreatorSections(tasks: TaskView[], members: MemberView[], timezone: string, today: string): TaskSectionData[] {
  const sections: TaskSectionData[] = members.map((member) => ({ key: `creator:${member.userId}`, title: `Created by ${member.displayName}`, tasks: sortTasks(tasks.filter((task) => task.createdBy === member.userId), timezone, today) }));
  const knownIds = new Set(members.map((member) => member.userId));
  const other = tasks.filter((task) => !knownIds.has(task.createdBy));
  if (other.length) sections.push({ key: "creator:former-member", title: "Created by a former member", tasks: sortTasks(other, timezone, today) });
  return sections;
}

function buildCategorySections(tasks: TaskView[], lists: ListView[], timezone: string, today: string): TaskSectionData[] {
  const sections: TaskSectionData[] = lists.map((list) => ({ key: `category:${list.id}`, title: list.name, color: list.color, tasks: sortTasks(tasks.filter((task) => task.listId === list.id), timezone, today) }));
  const knownIds = new Set(lists.map((list) => list.id));
  const uncategorized = tasks.filter((task) => !task.listId || !knownIds.has(task.listId));
  if (uncategorized.length) sections.push({ key: "category:inbox", title: "Inbox", color: "#64748b", tasks: sortTasks(uncategorized, timezone, today) });
  return sections;
}

function TaskSection({ title, color, tasks, lists, members, timezone, collapseOverflow = false, onEdit, onToggle }: {
  title: string;
  color?: string;
  tasks: TaskView[];
  lists: ListView[];
  members: MemberView[];
  timezone: string;
  collapseOverflow?: boolean;
  onEdit: (id: string) => void;
  onToggle: (task: TaskView, completed: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = Math.max(0, tasks.length - 1);
  const visibleTasks = collapseOverflow && !expanded ? tasks.slice(0, 1) : tasks;
  return <section><div className="mb-1.5 flex items-center justify-between px-1 text-xs font-bold"><span className="flex items-center gap-1.5">{color && <span className="size-2.5 rounded-full ring-1 ring-black/10" style={{ backgroundColor: color }} />}{title === "Overdue" && <CircleAlert className="size-3.5 text-destructive" />}{title === "Recently completed" && <CheckCircle2 className="size-3.5 text-success" />}{title}</span><span className="font-normal text-muted-foreground">{tasks.length}</span></div><div className="grid gap-1">{visibleTasks.map((task) => <TaskRow key={task.id} task={task} list={lists.find((list) => list.id === task.listId)} member={members.find((member) => member.userId === task.assigneeUserId)} timezone={timezone} onEdit={onEdit} onToggle={onToggle} />)}{collapseOverflow && hiddenCount > 0 && <Button type="button" variant="ghost" size="sm" className="h-7 justify-start px-2 text-xs text-muted-foreground" aria-expanded={expanded} aria-label={`${expanded ? "Collapse" : "Expand"} ${title} tasks`} onClick={() => setExpanded((value) => !value)}>{expanded ? <ChevronUp /> : <ChevronDown />}{expanded ? "Show less" : `Show ${hiddenCount} more`}</Button>}</div></section>;
}

function TaskRow({ task, list, member, timezone, onEdit, onToggle }: { task: TaskView; list?: ListView; member?: MemberView; timezone: string; onEdit: (id: string) => void; onToggle: (task: TaskView, completed: boolean) => void }) {
  const due = task.dueAt ? utcToLocalParts(task.dueAt, timezone) : null;
  const dueLabel = due ? formatDueDate(due.date, due.time, task.dueIsAllDay, dateKey(zonedNow(timezone))) : list?.name ?? "Inbox";
  const categoryColor = list?.color ?? "#64748b";
  return <ItemHoverDetails title={task.title} description={task.notes} meta={dueLabel}><div role="button" tabIndex={0} onClick={() => onEdit(task.id)} onKeyDown={(event) => { if (event.key === "Enter") onEdit(task.id); }} className="grid cursor-pointer grid-cols-[22px_1fr_auto] items-start gap-2 rounded-lg border border-l-[3px] border-transparent p-2 hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ borderLeftColor: categoryColor, backgroundColor: `color-mix(in srgb, ${categoryColor} 8%, transparent)` }} data-testid={`task-${task.id}`}>
    <Checkbox checked={Boolean(task.completedAt)} onCheckedChange={(checked) => onToggle(task, Boolean(checked))} onClick={(event) => event.stopPropagation()} aria-label={`${task.completedAt ? "Reopen" : "Complete"} ${task.title}`} className="mt-0.5" />
    <div className="min-w-0"><div className={cn("truncate text-sm font-medium", task.completedAt && "text-muted-foreground line-through")}>{task.title}</div><div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground"><span>{dueLabel}</span>{due && list && <span className="inline-flex items-center gap-1">• <span className="size-2 rounded-full" style={{ backgroundColor: categoryColor }} />{list.name}</span>}{task.priority !== "none" && <span className="inline-flex items-center gap-0.5 capitalize"><Flag className="size-3" />{task.priority}</span>}{task.recurrence && <span className="inline-flex items-center gap-0.5" title={recurrenceLabel(task.recurrence)}><Repeat2 className="size-3" />{recurrenceLabel(task.recurrence)}</span>}</div></div>
    <div className="flex items-center gap-1.5">{member && <span title={member.displayName} className="grid size-6 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">{initials(member.displayName)}</span>}</div>
  </div></ItemHoverDetails>;
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
