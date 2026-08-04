"use client";

import { CalendarDays, ChevronLeft, ChevronRight, ListChecks, Menu, NotebookTabs, PanelLeftOpen, PanelRightOpen, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { ActivitySummary } from "@/components/activity/activity-summary";
import { SidebarResizeHandle } from "@/components/app-shell/sidebar-resize-handle";
import { CalendarView, calendarPeriodLabel, shiftCalendarPeriod, type CalendarMode, type CalendarSelection } from "@/components/calendar/calendar-view";
import { ItemEditor } from "@/components/item-editor/item-editor";
import { TaskPanel, type TaskFilter } from "@/components/tasks/task-panel";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dateKey, localDate, zonedNow } from "@/lib/dates/timezone";
import type { ActivityPage } from "@/lib/activity/types";
import type { AppData } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TandemApp({ data, activityData, initialView = "month", initialDate, initialActivityOpen = false }: { data: AppData; activityData: ActivityPage; initialView?: CalendarMode; initialDate?: string; initialActivityOpen?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<CalendarMode>(initialView);
  const [anchor, setAnchor] = useState(() => initialDate ? localDate(initialDate) : new Date());
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [mobileScreen, setMobileScreen] = useState<"calendar" | "tasks">("calendar");
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [desktopTaskSidebarOpen, setDesktopTaskSidebarOpen] = useState(true);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(236);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(340);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selection, setSelection] = useState<CalendarSelection | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable || event.metaKey || event.ctrlKey || event.altKey) return;
      if (["n", "c"].includes(event.key.toLowerCase())) {
        setSelection({ type: "task", date: dateKey(new Date()) });
        setEditorOpen(true);
      }
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);

  function openEditor(next: CalendarSelection) {
    setSelection(next);
    setEditorOpen(true);
  }

  function updateCalendar(nextMode: CalendarMode, nextAnchor = anchor) {
    setMode(nextMode);
    setAnchor(nextAnchor);
    router.replace(`/app?view=${nextMode}&date=${dateKey(nextAnchor)}`, { scroll: false });
  }

  function showTasks() {
    setMobileScreen("tasks");
    setDesktopTaskSidebarOpen(true);
  }

  function goToToday() {
    updateCalendar("today", localDate(dateKey(zonedNow(data.workspace.timezone))));
  }

  const sidebar = <AppSidebar surface="calendar" workspace={data.workspace} members={data.members} lists={data.lists} tasks={data.tasks} filter={filter} onFilter={setFilter} onAdd={() => openEditor({ type: "event", date: dateKey(anchor) })} onShowTasks={showTasks} onShowCalendar={() => setMobileScreen("calendar")} onShowAgenda={() => router.push("/app/my-list")} onNavigate={() => setMobileNavOpen(false)} onCollapse={() => setLeftSidebarOpen(false)} />;
  const gridColumns = `${leftSidebarOpen ? leftSidebarWidth : 44}px minmax(0, 1fr) ${desktopTaskSidebarOpen ? rightSidebarWidth : 44}px`;

  return (
    <main className="grid h-dvh overflow-hidden bg-background max-[820px]:block" style={{ gridTemplateColumns: gridColumns }} data-testid="tandem-app">
      <aside className="relative min-h-0 border-r bg-card/95 max-[820px]:hidden" aria-label="Primary navigation">{leftSidebarOpen ? <>{sidebar}<SidebarResizeHandle label="Resize navigation sidebar" side="left" value={leftSidebarWidth} min={180} max={472} onResize={(delta) => setLeftSidebarWidth((width) => Math.min(472, Math.max(180, width + delta)))} /></> : <div className="flex h-[62px] items-center justify-center border-b"><Button variant="ghost" size="icon-sm" aria-label="Show navigation sidebar" onClick={() => setLeftSidebarOpen(true)}><PanelLeftOpen /></Button></div>}</aside>
      <section className={cn("flex min-h-0 min-w-0 flex-col bg-card max-[820px]:h-dvh max-[820px]:pb-[66px]", mobileScreen === "tasks" && "max-[820px]:invisible")}>
        <header className="flex h-[62px] min-w-0 shrink-0 items-center gap-2 overflow-hidden border-b px-4 max-[820px]:h-[58px] max-[820px]:px-2.5">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="hidden max-[820px]:inline-flex" aria-label="Open navigation"><Menu /></Button></SheetTrigger><SheetContent side="left" className="w-[300px] p-0"><SheetHeader className="sr-only"><SheetTitle>Navigation</SheetTitle><SheetDescription>Workspace and task views</SheetDescription></SheetHeader>{sidebar}</SheetContent></Sheet>
          {mode !== "events" && <div className="flex gap-0.5"><Button variant="ghost" size="icon" onClick={() => updateCalendar(mode, shiftCalendarPeriod(mode, anchor, -1))} aria-label="Previous period"><ChevronLeft /></Button><Button variant="ghost" size="icon" onClick={() => updateCalendar(mode, shiftCalendarPeriod(mode, anchor, 1))} aria-label="Next period"><ChevronRight /></Button></div>}
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight max-[820px]:text-base">{calendarPeriodLabel(mode, anchor)}</h1>
          <Select value={["today", "week", "month", "quarter"].includes(mode) ? mode : ""} onValueChange={(value) => { if (value === "today") goToToday(); else updateCalendar(value as CalendarMode); }}><SelectTrigger size="sm" className="w-[112px] shrink-0" aria-label="Calendar view"><SelectValue placeholder="Calendar" /></SelectTrigger><SelectContent align="end"><SelectItem value="today">Today</SelectItem><SelectItem value="week">Week</SelectItem><SelectItem value="month">Month</SelectItem><SelectItem value="quarter">3 Month</SelectItem></SelectContent></Select>
          <div className="flex shrink-0 items-center gap-1 max-[820px]:hidden"><Button size="sm" variant={mode === "events" ? "secondary" : "ghost"} onClick={() => updateCalendar("events", zonedNow(data.workspace.timezone))}>Events</Button><Button size="sm" variant="ghost" onClick={() => router.push("/app/my-list")}>My List</Button></div>
          <ActivitySummary initialData={activityData} initialOpen={initialActivityOpen} />
          <Button variant="outline" className="shrink-0 max-[1100px]:hidden" onClick={() => openEditor({ type: "event", date: dateKey(anchor) })}><Plus />Add</Button>
        </header>
        <div className="flex min-h-0 flex-1"><CalendarView mode={mode} anchor={anchor} timezone={data.workspace.timezone} tasks={data.tasks} events={data.events} lists={data.lists} onSelect={openEditor} /></div>
      </section>
      {desktopTaskSidebarOpen ? <div className="relative min-h-0 max-[820px]:hidden"><SidebarResizeHandle label="Resize tasks sidebar" side="right" value={rightSidebarWidth} min={260} max={680} onResize={(delta) => setRightSidebarWidth((width) => Math.min(680, Math.max(260, width + delta)))} /><TaskPanel tasks={data.tasks} lists={data.lists} members={data.members} timezone={data.workspace.timezone} filter={filter} onEdit={(id) => openEditor({ type: "task", id })} onAdd={() => openEditor({ type: "task" })} onClose={() => setDesktopTaskSidebarOpen(false)} className="h-full w-full" /></div> : <aside className="flex min-h-0 items-start justify-center border-l bg-card/95 pt-[14px] max-[820px]:hidden" aria-label="Collapsed tasks sidebar"><Button variant="ghost" size="icon-sm" aria-label="Show tasks sidebar" onClick={() => setDesktopTaskSidebarOpen(true)}><PanelRightOpen /></Button></aside>}
      <TaskPanel tasks={data.tasks} lists={data.lists} members={data.members} timezone={data.workspace.timezone} filter={filter} onEdit={(id) => openEditor({ type: "task", id })} onAdd={() => openEditor({ type: "task" })} onClose={() => setMobileScreen("calendar")} className={cn("hidden", mobileScreen === "tasks" && "max-[820px]:fixed max-[820px]:inset-x-0 max-[820px]:bottom-[66px] max-[820px]:top-[58px] max-[820px]:z-20 max-[820px]:flex max-[820px]:border-l-0")} />
      <Button size="icon-lg" className="fixed bottom-20 right-4 z-30 hidden size-13 rounded-full shadow-xl max-[820px]:inline-flex" onClick={() => openEditor({ type: "task", date: dateKey(anchor) })} aria-label="Add item"><Plus /></Button>
      <nav className="fixed inset-x-0 bottom-0 z-30 hidden h-[66px] grid-cols-4 border-t bg-card/95 px-3 pb-[max(5px,env(safe-area-inset-bottom))] pt-1 backdrop-blur max-[820px]:grid" aria-label="Mobile navigation">
        <MobileNavButton active={mobileScreen === "calendar"} icon={CalendarDays} label="Calendar" onClick={() => setMobileScreen("calendar")} />
        <MobileNavButton icon={NotebookTabs} label="My List" onClick={() => router.push("/app/my-list")} />
        <MobileNavButton icon={Plus} label="Add" onClick={() => openEditor({ type: "task", date: dateKey(anchor) })} />
        <MobileNavButton active={mobileScreen === "tasks"} icon={ListChecks} label="Tasks" onClick={showTasks} />
      </nav>
      <ItemEditor open={editorOpen} selection={selection} timezone={data.workspace.timezone} tasks={data.tasks} events={data.events} lists={data.lists} members={data.members} onOpenChange={setEditorOpen} onTaskCreated={showTasks} />
    </main>
  );
}

function MobileNavButton({ active, icon: Icon, label, onClick }: { active?: boolean; icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return <button onClick={onClick} className={cn("grid min-h-11 place-items-center content-center gap-0.5 rounded-lg text-[10px] text-muted-foreground", active && "text-primary")}><Icon className="size-5" /><span>{label}</span></button>;
}
