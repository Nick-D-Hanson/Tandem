"use client";

import { closestCenter, DndContext, DragOverlay, KeyboardSensor, pointerWithin, PointerSensor, TouchSensor, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { format } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Inbox, LayoutGrid, ListChecks, Menu, PanelLeftOpen, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type Ref } from "react";
import { toast } from "sonner";

import { ActivitySummary } from "@/components/activity/activity-summary";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { SidebarResizeHandle } from "@/components/app-shell/sidebar-resize-handle";
import { PlannerTaskCard, PlannerTaskCardOverlay } from "@/components/tasks/planner-task-card";
import { PlannerTaskEditor } from "@/components/tasks/planner-task-editor";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { reorderPlannerTasksAction, saveTaskAction, toggleTaskAction } from "@/lib/actions/items";
import type { ActivityPage } from "@/lib/activity/types";
import { localDate } from "@/lib/dates/timezone";
import { changedPlannerTasks, moveTaskToQuadrant, moveTaskToSchedule, plannerRollingDays, plannerWeekDays, plannerWeekLabel, plannerWeekStart, quadrantDetails, shiftPlannerWeek, sortPlannerTasks, tasksForQuadrant, tasksForSchedule, type PlannerQuadrant, type PlannerView } from "@/lib/tasks/planner";
import type { AppData, TaskView } from "@/lib/types";
import { cn } from "@/lib/utils";

type MatrixFilter = "all" | "week" | "unscheduled";
type DropContext = "schedule" | "backlog" | "matrix";

export function TaskWorkspace({ data, activityData, today, initialWeek, initialView = "week", initialActivityOpen = false }: {
  data: AppData;
  activityData: ActivityPage;
  today: string;
  initialWeek: string;
  initialView?: PlannerView;
  initialActivityOpen?: boolean;
}) {
  const router = useRouter();
  const [taskState, setTaskState] = useState(() => ({ source: data.tasks, current: data.tasks }));
  const [view, setView] = useState<PlannerView>(initialView);
  const [rangeStartOverride, setRangeStartOverride] = useState<string | null>(() => initialWeek === today || initialWeek === plannerWeekStart(today) ? null : initialWeek);
  const [showCompleted, setShowCompleted] = useState(false);
  const [matrixFilter, setMatrixFilter] = useState<MatrixFilter>("all");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<TaskView | null>(null);
  const [backlogInputOpen, setBacklogInputOpen] = useState(false);
  const [backlogSheetOpen, setBacklogSheetOpen] = useState(false);
  const [mobileDay, setMobileDay] = useState(today);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(228);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const backlogScrollRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 170, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (taskState.source !== data.tasks) setTaskState({ source: data.tasks, current: data.tasks });
  const tasks = taskState.current;
  const rollingDays = useMemo(() => plannerRollingDays(today, tasks), [tasks, today]);
  const weekStart = rangeStartOverride ?? rollingDays[0];
  const weekDays = useMemo(() => plannerWeekDays(weekStart), [weekStart]);

  function setTasks(value: TaskView[] | ((current: TaskView[]) => TaskView[])) {
    setTaskState((state) => ({ ...state, current: typeof value === "function" ? value(state.current) : value }));
  }

  const visibleTasks = useMemo(() => showCompleted ? tasks : tasks.filter((task) => !task.completedAt), [showCompleted, tasks]);
  const allWeeklyTasks = tasks.filter((task) => task.scheduledDate && weekDays.includes(task.scheduledDate));
  const completedThisWeek = allWeeklyTasks.filter((task) => task.completedAt).length;
  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? null;
  const backlogTasks = tasksForSchedule(visibleTasks, null);
  const selectedMobileDay = weekDays.includes(mobileDay) ? mobileDay : (weekDays.includes(today) ? today : weekDays[0]);

  useEffect(() => {
    if (backlogSheetOpen) backlogScrollRef.current?.scrollTo({ top: 0 });
  }, [backlogSheetOpen]);

  function navigate(nextView: PlannerView, nextWeek?: string) {
    setView(nextView);
    const nextStart = nextWeek ?? weekStart;
    if (nextWeek) setRangeStartOverride(nextWeek);
    const nextDays = plannerWeekDays(nextStart);
    if (!nextDays.includes(mobileDay)) setMobileDay(nextDays.includes(today) ? today : nextDays[0]);
    const routeStart = nextWeek ?? (rangeStartOverride === null ? today : nextStart);
    router.replace(`/app/my-list?view=${nextView}&week=${routeStart}`, { scroll: false });
  }

  function goToToday() {
    setRangeStartOverride(null);
    setMobileDay(today);
    router.replace(`/app/my-list?view=${view}&week=${today}`, { scroll: false });
  }

  function openBacklog(startCapture = false) {
    if (startCapture) setBacklogInputOpen(true);
    if (window.matchMedia("(max-width: 960px)").matches) setBacklogSheetOpen(true);
  }

  function persistPlannerState(previous: TaskView[], next: TaskView[]) {
    const changes = changedPlannerTasks(previous, next);
    if (!changes.length) return;
    setTasks(next);
    startTransition(async () => {
      const result = await reorderPlannerTasksAction({ tasks: changes });
      if (!result.ok) {
        setTasks(previous);
        toast.error(result.error, { description: "The task was returned to its previous position." });
        return;
      }
      router.refresh();
    });
  }

  function moveSchedule(task: TaskView, date: string | null, beforeTaskId?: string) {
    persistPlannerState(tasks, moveTaskToSchedule(tasks, task.id, date, beforeTaskId));
  }

  function setQuadrant(task: TaskView, quadrant: PlannerQuadrant | null, beforeTaskId?: string) {
    persistPlannerState(tasks, moveTaskToQuadrant(tasks, task.id, quadrant, beforeTaskId));
  }

  function dragEnd(event: DragEndEvent) {
    setActiveTaskId(null);
    const taskId = String(event.active.data.current?.taskId ?? "");
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task || !event.over) return;
    const overData = event.over.data.current;
    const context = overData?.context as DropContext | undefined;
    const beforeTaskId = overData?.kind === "task" ? String(overData.taskId) : undefined;
    if (context === "matrix") {
      setQuadrant(task, (overData?.quadrant ?? null) as PlannerQuadrant | null, beforeTaskId);
      return;
    }
    if (context === "schedule" || context === "backlog") {
      moveSchedule(task, context === "backlog" ? null : String(overData?.scheduledDate), beforeTaskId);
    }
  }

  function toggle(task: TaskView, completed: boolean) {
    const previous = tasks;
    setTasks((current) => current.map((candidate) => candidate.id === task.id ? { ...candidate, completedAt: completed ? new Date().toISOString() : null } : candidate));
    startTransition(async () => {
      const result = await toggleTaskAction({ id: task.id, completed });
      if (!result.ok) { setTasks(previous); toast.error(result.error); return; }
      toast.success(completed ? "Task completed" : "Task reopened", { description: task.title });
      router.refresh();
    });
  }

  async function createTask(title: string, scheduledDate: string | null, quadrant: PlannerQuadrant | null = null) {
    const result = await saveTaskAction({ title, notes: "", scheduledDate: scheduledDate ?? "", dueDate: "", dueTime: "", assigneeUserId: "", listId: "", priority: "none", quadrant, recurrence: null });
    if (!result.ok) { toast.error(result.error); return false; }
    const now = new Date().toISOString();
    const position = Math.max(-1, ...tasks.map((task) => task.position)) + 1;
    setTasks((current) => [...current, { id: result.data.id, title, notes: null, scheduledDate, dueAt: null, dueIsAllDay: true, assigneeUserId: null, listId: null, priority: "none", quadrant, completedAt: null, recurrence: null, createdBy: data.currentUserId, updatedBy: data.currentUserId, position, createdAt: now, updatedAt: now }]);
    toast.success(scheduledDate ? `Added to ${format(localDate(scheduledDate), "EEEE")}` : "Added to Backlog");
    router.refresh();
    return true;
  }

  const cardActions = { timezone: data.workspace.timezone, lists: data.lists, weekDays, onToggle: toggle, onEdit: setEditingTask, onMoveSchedule: moveSchedule, onSetQuadrant: setQuadrant };
  const sidebar = <AppSidebar surface="tasks" workspace={data.workspace} members={data.members} lists={data.lists} tasks={tasks} filter="all" onFilter={(filter) => router.push(`/app?tasks=${encodeURIComponent(filter)}`)} onAdd={() => openBacklog(true)} onShowTasks={() => undefined} onShowCalendar={() => router.push("/app")} onShowMyList={() => setMobileNavOpen(false)} onNavigate={() => setMobileNavOpen(false)} onCollapse={() => setLeftSidebarOpen(false)} />;

  return (
    <main className="task-workspace-theme grid h-dvh overflow-hidden bg-[#f7f8fb] text-[#293044] max-[820px]:block" style={{ gridTemplateColumns: `${leftSidebarOpen ? leftSidebarWidth : 44}px minmax(0,1fr)` }} data-testid="task-workspace">
      <aside className="relative min-h-0 border-r border-[#e8eaf0] bg-white max-[820px]:hidden" aria-label="Primary navigation">{leftSidebarOpen ? <>{sidebar}<SidebarResizeHandle label="Resize navigation sidebar" side="left" value={leftSidebarWidth} min={180} max={360} onResize={(delta) => setLeftSidebarWidth((width) => Math.min(360, Math.max(180, width + delta)))} /></> : <div className="flex h-[62px] items-center justify-center border-b"><Button variant="ghost" size="icon-sm" aria-label="Show navigation sidebar" onClick={() => setLeftSidebarOpen(true)}><PanelLeftOpen /></Button></div>}</aside>
      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden max-[820px]:h-dvh max-[820px]:pb-[66px]">
        <header className="flex min-h-[68px] shrink-0 flex-wrap items-center gap-2 border-b border-[#e7e9ef] bg-white px-4 py-2.5 max-[820px]:min-h-[58px] max-[820px]:px-2.5">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="hidden max-[820px]:inline-flex" aria-label="Open navigation"><Menu /></Button></SheetTrigger><SheetContent side="left" className="w-[300px] p-0"><SheetHeader className="sr-only"><SheetTitle>Navigation</SheetTitle><SheetDescription>Workspace navigation</SheetDescription></SheetHeader>{sidebar}</SheetContent></Sheet>
          <div className="min-w-0 flex-1"><h1 className="truncate text-xl font-semibold tracking-[-.03em] text-[#252b3b] max-[820px]:text-base">My List</h1><p className="truncate text-xs text-[#898e9c] max-[520px]:hidden">Shared weekly planning · {data.workspace.timezone}</p></div>
          <ActivitySummary initialData={activityData} initialOpen={initialActivityOpen} />
          <Button type="button" className="bg-[#6b5bc6] text-white hover:bg-[#5f4eb8]" onClick={() => openBacklog(true)}><Plus /><span className="max-[420px]:sr-only">Task</span></Button>
        </header>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#e7e9ef] bg-white px-4 py-3 max-[640px]:px-3 max-[640px]:py-2">
          <div className="flex min-w-0 items-center gap-1"><Button type="button" variant="outline" size="icon-sm" aria-label="Previous 7 days" onClick={() => navigate(view, shiftPlannerWeek(weekStart, -1))}><ChevronLeft /></Button><Button type="button" variant="outline" size="sm" onClick={goToToday}>Today</Button><Button type="button" variant="outline" size="icon-sm" aria-label="Next 7 days" onClick={() => navigate(view, shiftPlannerWeek(weekStart, 1))}><ChevronRight /></Button><strong className="ml-2 truncate text-sm font-semibold text-[#34394a] max-[480px]:max-w-[130px]">{plannerWeekLabel(weekStart)}</strong></div>
          <div className="flex items-center gap-2 max-[640px]:w-full max-[640px]:justify-between max-[420px]:gap-1"><Button type="button" variant="outline" size="sm" className="hidden min-h-9 gap-1.5 border-[#ded9f3] px-2.5 text-[#6253b4] max-[960px]:inline-flex" onClick={() => openBacklog()}><Inbox className="size-3.5" />Backlog<span className="rounded bg-[#f0edfb] px-1.5 py-0.5 text-[10px]">{backlogTasks.filter((task) => !task.completedAt).length}</span></Button><label className="flex min-h-9 items-center gap-2 rounded-lg border border-[#e4e6ed] bg-white px-3 text-xs text-[#656b79] max-[420px]:px-2"><input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} className="accent-[#6b5bc6]" /><span className="max-[520px]:hidden">Show completed</span><span className="min-[521px]:hidden">Done</span></label><div className="flex rounded-[10px] border border-[#e4e5eb] bg-[#eeeff3] p-0.5" role="tablist" aria-label="Planner view"><button type="button" role="tab" aria-selected={view === "week"} onClick={() => navigate("week")} className={cn("flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[#6f7480] max-[420px]:px-2.5", view === "week" && "bg-white text-[#5647a9] shadow-sm")}><CalendarDays className="size-3.5" />Week</button><button type="button" role="tab" aria-selected={view === "matrix"} onClick={() => navigate("matrix")} className={cn("flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[#6f7480] max-[420px]:px-2.5", view === "matrix" && "bg-white text-[#5647a9] shadow-sm")}><LayoutGrid className="size-3.5" />Matrix</button></div></div>
        </div>
        <DndContext sensors={sensors} collisionDetection={plannerCollisionDetection} onDragStart={(event) => setActiveTaskId(String(event.active.data.current?.taskId ?? ""))} onDragCancel={() => setActiveTaskId(null)} onDragEnd={dragEnd}>
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_clamp(260px,25vw,340px)] gap-3 overflow-hidden p-3 max-[960px]:grid-cols-1 max-[960px]:overflow-auto max-[640px]:p-2">
            <section className="min-h-0 min-w-0 overflow-auto rounded-[14px]" aria-label="Task planner">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1 max-[640px]:mb-2"><div><h2 className="text-[22px] font-semibold tracking-[-.03em] text-[#252b3b] max-[640px]:text-lg">{view === "week" ? (rangeStartOverride === null ? "Rolling 7 days" : "7-day plan") : "Priority matrix"}</h2><p className="text-xs text-[#858b98]">{view === "week" ? `${completedThisWeek} of ${allWeeklyTasks.length} planned tasks completed${rangeStartOverride === null && weekStart !== today ? " · includes yesterday’s unfinished tasks" : ""}` : "Priority and scheduled day are independent"}</p></div>{view === "matrix" && <div className="flex gap-1" role="group" aria-label="Filter matrix tasks">{(["all", "week", "unscheduled"] as MatrixFilter[]).map((filter) => <Button key={filter} type="button" variant={matrixFilter === filter ? "secondary" : "ghost"} size="sm" className="h-8 capitalize" onClick={() => setMatrixFilter(filter)}>{filter === "week" ? "7-day window" : filter}</Button>)}</div>}</div>
              {view === "week" ? <WeekPlanner tasks={visibleTasks} weekDays={weekDays} today={today} selectedDate={selectedMobileDay} onSelectedDate={setMobileDay} cardActions={cardActions} onCreate={createTask} /> : <MatrixPlanner tasks={visibleTasks} weekDays={weekDays} filter={matrixFilter} cardActions={cardActions} onCreate={createTask} />}
              <p className="px-1 pb-2 pt-3 text-[11px] text-[#888d99]">Drag to reorder or move tasks. Every move is also available from the task menu.</p>
            </section>
            <div className="min-h-0 max-[960px]:hidden"><BacklogPanel tasks={backlogTasks} weekDays={weekDays} inputOpen={backlogInputOpen} onInputOpenChange={setBacklogInputOpen} cardActions={cardActions} onCreate={createTask} /></div>
          </div>
          <Sheet open={backlogSheetOpen} onOpenChange={setBacklogSheetOpen}><SheetContent side="bottom" showCloseButton={false} style={{ height: "min(88dvh, 760px)" }} className="task-workspace-theme flex flex-col gap-0 overflow-hidden rounded-t-[22px] bg-[#f7f8fb] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] min-[961px]:hidden"><SheetClose asChild><Button type="button" variant="ghost" size="icon-sm" className="absolute right-6 top-6 z-10" aria-label="Close backlog"><X /></Button></SheetClose><SheetHeader className="sr-only"><SheetTitle>Backlog</SheetTitle><SheetDescription>Unscheduled tasks</SheetDescription></SheetHeader><BacklogPanel tasks={backlogTasks} weekDays={weekDays} inputOpen={backlogInputOpen} onInputOpenChange={setBacklogInputOpen} cardActions={cardActions} onCreate={createTask} listRef={backlogScrollRef} sheet /></SheetContent></Sheet>
          <DragOverlay>{activeTask ? <PlannerTaskCardOverlay task={activeTask} timezone={data.workspace.timezone} lists={data.lists} /> : null}</DragOverlay>
        </DndContext>
      </section>
      <nav className="fixed inset-x-0 bottom-0 z-30 hidden h-[66px] grid-cols-3 border-t bg-white/95 px-3 pb-[max(5px,env(safe-area-inset-bottom))] pt-1 backdrop-blur max-[820px]:grid" aria-label="Mobile navigation"><MobileLink icon={CalendarDays} label="Calendar" onClick={() => router.push("/app")} /><MobileLink active icon={ListChecks} label="My List" onClick={() => undefined} /><MobileLink icon={Plus} label="Add" onClick={() => openBacklog(true)} /></nav>
      <PlannerTaskEditor task={editingTask} open={Boolean(editingTask)} timezone={data.workspace.timezone} lists={data.lists} members={data.members} onOpenChange={(open) => !open && setEditingTask(null)} />
    </main>
  );
}

function WeekPlanner({ tasks, weekDays, today, selectedDate, onSelectedDate, cardActions, onCreate }: { tasks: TaskView[]; weekDays: string[]; today: string; selectedDate: string; onSelectedDate: (date: string) => void; cardActions: CardActions; onCreate: CreateTask }) {
  return <><div className="-mx-1 mb-2 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1 sm:hidden" role="tablist" aria-label="Days in this 7-day window">{weekDays.map((date) => { const count = tasksForSchedule(tasks, date).filter((task) => !task.completedAt).length; const selected = date === selectedDate; return <button key={date} type="button" role="tab" aria-selected={selected} onClick={() => onSelectedDate(date)} className={cn("grid min-h-[58px] min-w-[58px] snap-start place-items-center rounded-xl border bg-white px-2 py-1 text-[#777d8b]", selected && "border-[#8f80d8] bg-[#f2efff] text-[#5848aa] shadow-sm", date === today && !selected && "border-[#cbc3ef]")}><span className="text-[10px] font-semibold uppercase">{format(localDate(date), "EEE")}</span><span className="text-sm font-bold">{format(localDate(date), "d")}</span>{count > 0 ? <span className="text-[9px]">{count} task{count === 1 ? "" : "s"}</span> : <span className="text-[9px] text-[#a4a8b2]">Empty</span>}</button>; })}</div><div className="grid min-w-0 grid-cols-1 items-stretch gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">{weekDays.map((date) => { const dayTasks = tasksForSchedule(tasks, date); return <PlannerZone key={date} id={`schedule:${date}`} context="schedule" scheduledDate={date} className={cn("flex min-h-[calc(100dvh-355px)] min-w-0 flex-col overflow-hidden rounded-[13px] border border-[#e8eaf1] bg-white shadow-[0_2px_12px_rgba(32,44,69,.06)] sm:min-h-[260px] 2xl:min-h-[calc(100dvh-245px)]", date !== selectedDate && "max-sm:hidden", date === today && "border-[#bdb4ee] shadow-[0_0_0_2px_#eeeafd]")}><header className="flex min-h-[58px] items-center justify-between border-b border-[#eef0f2] px-3 py-2 sm:min-h-[66px]"><div><strong className={cn("text-sm font-semibold sm:text-xs", date === today && "text-[#5b4bb2]")}>{format(localDate(date), "EEEE")}</strong><span className="mt-0.5 block text-[11px] text-[#9399a6]">{format(localDate(date), "MMM d")}{date === today ? " · Today" : ""}</span></div><span className="rounded-md bg-[#f1f2f6] px-1.5 py-0.5 text-[11px] text-[#7b8291]">{dayTasks.filter((task) => !task.completedAt).length}</span></header><SortableTaskList tasks={dayTasks} context="schedule" instancePrefix={`schedule:${date}`} cardActions={cardActions} empty="Nothing planned. Add a task or schedule one from Backlog." /><InlineTaskInput label="Add task" onCreate={(title) => onCreate(title, date)} /></PlannerZone>; })}</div></>;
}

function MatrixPlanner({ tasks, weekDays, filter, cardActions, onCreate }: { tasks: TaskView[]; weekDays: string[]; filter: MatrixFilter; cardActions: CardActions; onCreate: CreateTask }) {
  const filtered = tasks.filter((task) => filter === "all" || (filter === "week" ? Boolean(task.scheduledDate && weekDays.includes(task.scheduledDate)) : task.scheduledDate === null));
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{([1, 2, 3, 4] as PlannerQuadrant[]).map((quadrant) => { const quadrantTasks = tasksForQuadrant(filtered, quadrant); return <PlannerZone key={quadrant} id={`matrix:${quadrant}`} context="matrix" quadrant={quadrant} className="min-h-[260px] overflow-hidden rounded-[13px] border border-[#e8eaf1] bg-white shadow-[0_2px_12px_rgba(32,44,69,.06)]"><header className={cn("border-b border-[#eceef2] px-4 py-3", quadrant === 1 && "bg-[#fff3f1]", quadrant === 2 && "bg-[#f1f5ff]", quadrant === 3 && "bg-[#fff9e9]", quadrant === 4 && "bg-[#f7f7f8]")}><div className="flex items-center justify-between"><strong className="text-sm">Q{quadrant} · {quadrantDetails[quadrant].action}</strong><span className="rounded-md bg-white/70 px-1.5 py-0.5 text-[11px] text-[#747985]">{quadrantTasks.length}</span></div><p className="mt-1 text-xs text-[#757b88]">{quadrantDetails[quadrant].label} · {quadrantDetails[quadrant].description}</p></header><SortableTaskList tasks={quadrantTasks} context="matrix" instancePrefix={`matrix:${quadrant}`} cardActions={cardActions} showScheduledDate empty="Drag tasks here to set priority" /><InlineTaskInput label="Add task" onCreate={(title) => onCreate(title, null, quadrant)} /></PlannerZone>; })}<details className="md:col-span-2 rounded-[13px] border border-[#e8eaf1] bg-white" open><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#4d5362]">Unclassified tasks · {tasksForQuadrant(filtered, null).length}</summary><PlannerZone id="matrix:unclassified" context="matrix" quadrant={null} className="border-t border-[#eceef2]"><SortableTaskList tasks={tasksForQuadrant(filtered, null)} context="matrix" instancePrefix="matrix:unclassified" cardActions={cardActions} showScheduledDate empty="New captures appear here until you prioritize them" /></PlannerZone></details></div>;
}

function BacklogPanel({ tasks, weekDays, inputOpen, onInputOpenChange, cardActions, onCreate, listRef, sheet = false }: { tasks: TaskView[]; weekDays: string[]; inputOpen: boolean; onInputOpenChange: (open: boolean) => void; cardActions: CardActions; onCreate: CreateTask; listRef?: Ref<HTMLDivElement>; sheet?: boolean }) {
  return <PlannerZone id={sheet ? "backlog-sheet" : "backlog"} context="backlog" scheduledDate={null} className={cn("flex min-h-0 flex-col overflow-hidden rounded-[13px] border border-[#e8eaf1] bg-white shadow-[0_2px_12px_rgba(32,44,69,.06)]", sheet ? "flex-1" : "h-full")}><header className="border-b border-[#eef0f4] px-4 pb-3 pt-4"><div className="flex items-center justify-between pr-8"><strong className="flex items-center gap-2 text-[15px] text-[#30344a]"><Inbox className="size-4" />Backlog</strong><span className="rounded-md bg-[#f1f2f6] px-1.5 py-0.5 text-[11px] text-[#7b8291]">{tasks.filter((task) => !task.completedAt).length}</span></div><p className="mt-1 text-xs leading-5 text-[#898e9c]">Unscheduled tasks stay here, even when they have a due date.</p></header><SortableTaskList tasks={tasks} context="backlog" instancePrefix={sheet ? "backlog-sheet" : "backlog"} cardActions={{ ...cardActions, weekDays }} showScheduledDate={false} empty="Capture now. Schedule when ready." className="min-h-0 flex-1 overflow-y-auto overscroll-contain" scrollRef={listRef} /><InlineTaskInput label="Add to backlog" open={inputOpen} onOpenChange={onInputOpenChange} onCreate={(title) => onCreate(title, null)} /></PlannerZone>;
}

function PlannerZone({ id, context, scheduledDate, quadrant, className, children }: { id: string; context: DropContext; scheduledDate?: string | null; quadrant?: PlannerQuadrant | null; className?: string; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: `zone:${id}`, data: { kind: "zone", context, scheduledDate, quadrant } });
  return <div ref={setNodeRef} data-planner-zone={id} className={cn(className, isOver && "outline-2 outline-offset-[-4px] outline-dashed outline-[#a594e6] bg-[#f8f6ff]")}>{children}</div>;
}

function SortableTaskList({ tasks, context, instancePrefix, cardActions, showScheduledDate = false, empty, className, scrollRef }: { tasks: TaskView[]; context: DropContext; instancePrefix: string; cardActions: CardActions; showScheduledDate?: boolean; empty: string; className?: string; scrollRef?: Ref<HTMLDivElement> }) {
  const sorted = sortPlannerTasks(tasks);
  const ids = sorted.map((task) => `${instancePrefix}:task:${task.id}`);
  return <SortableContext items={ids} strategy={verticalListSortingStrategy}><div ref={scrollRef} className={cn("grid content-start gap-1.5 p-2", className)}>{sorted.length ? sorted.map((task) => <PlannerTaskCard key={task.id} task={task} instanceId={`${instancePrefix}:task:${task.id}`} context={context} showScheduledDate={showScheduledDate} {...cardActions} />) : <div className="grid min-h-20 place-items-center px-2 text-center text-[11px] text-[#a0a2ac]">{empty}</div>}</div></SortableContext>;
}

function InlineTaskInput({ label, onCreate, open: controlledOpen, onOpenChange }: { label: string; onCreate: (title: string) => Promise<boolean>; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  async function submit() {
    const value = title.trim();
    if (!value || pending) return;
    setPending(true);
    const created = await onCreate(value);
    setPending(false);
    if (created) setTitle("");
  }
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-auto flex min-h-10 w-full items-center gap-1.5 border-t border-[#eef0f4] px-3 text-left text-xs font-medium text-[#7564c7] hover:bg-[#f5f2ff]"><Plus className="size-3.5" />{label}</button>;
  return <div className="mt-auto border-t border-[#eef0f4] p-2"><input autoFocus value={title} disabled={pending} maxLength={120} aria-label={label} placeholder="Type a task and press Enter" onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void submit(); } if (event.key === "Escape" && !title) setOpen(false); }} className="h-9 w-full rounded-lg border border-[#dfe1e8] bg-white px-2.5 text-xs text-[#30374a] outline-none placeholder:text-[#a0a2ac] focus:border-[#8e7ada] focus:ring-2 focus:ring-[#eee9ff]" /></div>;
}

type CardActions = Pick<React.ComponentProps<typeof PlannerTaskCard>, "timezone" | "lists" | "weekDays" | "onToggle" | "onEdit" | "onMoveSchedule" | "onSetQuadrant">;
type CreateTask = (title: string, scheduledDate: string | null, quadrant?: PlannerQuadrant | null) => Promise<boolean>;

const plannerCollisionDetection: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  const taskTargets = pointer.filter((collision) => args.droppableContainers.find((container) => container.id === collision.id)?.data.current?.kind === "task");
  if (taskTargets.length) return taskTargets;
  return pointer.length ? pointer : closestCenter(args);
};

function MobileLink({ active, icon: Icon, label, onClick }: { active?: boolean; icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("grid min-h-11 place-items-center content-center gap-0.5 rounded-lg text-[10px] text-[#7c8290]", active && "text-[#6b5bc6]")}><Icon className="size-5" /><span>{label}</span></button>;
}
