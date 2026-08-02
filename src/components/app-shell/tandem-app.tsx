"use client";

import { CalendarDays, ChevronLeft, ChevronRight, ListChecks, Menu, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { CalendarView, calendarPeriodLabel, shiftCalendarPeriod, type CalendarMode, type CalendarSelection } from "@/components/calendar/calendar-view";
import { ItemEditor } from "@/components/item-editor/item-editor";
import { TaskPanel, type TaskFilter } from "@/components/tasks/task-panel";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { dateKey, localDate } from "@/lib/dates/timezone";
import type { AppData } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TandemApp({ data, initialView = "month", initialDate }: { data: AppData; initialView?: CalendarMode; initialDate?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<CalendarMode>(initialView);
  const [anchor, setAnchor] = useState(() => initialDate ? localDate(initialDate) : new Date());
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [mobileScreen, setMobileScreen] = useState<"calendar" | "tasks">("calendar");
  const [taskOverlay, setTaskOverlay] = useState(false);
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
    setTaskOverlay(true);
  }

  const sidebar = <AppSidebar workspace={data.workspace} members={data.members} lists={data.lists} tasks={data.tasks} filter={filter} onFilter={setFilter} onAdd={() => openEditor({ type: "event", date: dateKey(anchor) })} onShowTasks={showTasks} onNavigate={() => setMobileNavOpen(false)} />;

  return (
    <main className="grid h-dvh grid-cols-[236px_minmax(520px,1fr)_340px] overflow-hidden bg-background max-[1180px]:grid-cols-[220px_minmax(520px,1fr)] max-[820px]:block" data-testid="tandem-app">
      <aside className="min-h-0 border-r bg-card/95 max-[820px]:hidden" aria-label="Primary navigation">{sidebar}</aside>
      <section className={cn("flex min-h-0 min-w-0 flex-col bg-card max-[820px]:h-dvh max-[820px]:pb-[66px]", mobileScreen === "tasks" && "max-[820px]:invisible")}>
        <header className="flex h-[62px] shrink-0 items-center gap-2 border-b px-4 max-[820px]:h-[58px] max-[820px]:px-2.5">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="hidden max-[820px]:inline-flex" aria-label="Open navigation"><Menu /></Button></SheetTrigger><SheetContent side="left" className="w-[300px] p-0"><SheetHeader className="sr-only"><SheetTitle>Navigation</SheetTitle><SheetDescription>Workspace and task views</SheetDescription></SheetHeader>{sidebar}</SheetContent></Sheet>
          <div className="flex gap-0.5"><Button variant="ghost" size="icon" onClick={() => updateCalendar(mode, shiftCalendarPeriod(mode, anchor, -1))} aria-label="Previous period"><ChevronLeft /></Button><Button variant="ghost" size="icon" onClick={() => updateCalendar(mode, shiftCalendarPeriod(mode, anchor, 1))} aria-label="Next period"><ChevronRight /></Button></div>
          <h1 className="min-w-[160px] text-lg font-semibold tracking-tight max-[820px]:min-w-0 max-[820px]:flex-1 max-[820px]:text-base">{calendarPeriodLabel(mode, anchor)}</h1>
          <Button variant="outline" size="sm" onClick={() => updateCalendar(mode, new Date())}><CalendarDays /><span className="max-[480px]:hidden">Today</span></Button>
          <div className="flex-1 max-[820px]:hidden" />
          <ToggleGroup type="single" value={mode} onValueChange={(value) => value && updateCalendar(value as CalendarMode)} variant="outline" size="sm" className="max-[820px]:hidden"><ToggleGroupItem value="month">Month</ToggleGroupItem><ToggleGroupItem value="week">Week</ToggleGroupItem><ToggleGroupItem value="agenda">Agenda</ToggleGroupItem></ToggleGroup>
          <Button variant="outline" className="max-[820px]:hidden" onClick={() => openEditor({ type: "event", date: dateKey(anchor) })}><Plus />Add</Button>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="min-[1181px]:hidden max-[820px]:hidden" onClick={() => setTaskOverlay((value) => !value)} aria-label="Toggle tasks"><ListChecks /></Button></TooltipTrigger><TooltipContent>Tasks</TooltipContent></Tooltip>
        </header>
        <div className="flex min-h-0 flex-1"><CalendarView mode={mode} anchor={anchor} timezone={data.workspace.timezone} tasks={data.tasks} events={data.events} lists={data.lists} onSelect={openEditor} /></div>
      </section>
      <TaskPanel tasks={data.tasks} lists={data.lists} members={data.members} timezone={data.workspace.timezone} filter={filter} onEdit={(id) => openEditor({ type: "task", id })} onAdd={() => openEditor({ type: "task" })} className={cn("max-[1180px]:hidden min-[1181px]:flex", taskOverlay && "min-[821px]:max-[1180px]:fixed min-[821px]:max-[1180px]:inset-y-0 min-[821px]:max-[1180px]:right-0 min-[821px]:max-[1180px]:z-40 min-[821px]:max-[1180px]:flex min-[821px]:max-[1180px]:w-[360px] min-[821px]:max-[1180px]:shadow-2xl", mobileScreen === "tasks" && "max-[820px]:fixed max-[820px]:inset-x-0 max-[820px]:top-[58px] max-[820px]:bottom-[66px] max-[820px]:z-20 max-[820px]:flex max-[820px]:border-l-0")} />
      <Button size="icon-lg" className="fixed bottom-20 right-4 z-30 hidden size-13 rounded-full shadow-xl max-[820px]:inline-flex" onClick={() => openEditor({ type: "task", date: dateKey(anchor) })} aria-label="Add item"><Plus /></Button>
      <nav className="fixed inset-x-0 bottom-0 z-30 hidden h-[66px] grid-cols-3 border-t bg-card/95 px-3 pb-[max(5px,env(safe-area-inset-bottom))] pt-1 backdrop-blur max-[820px]:grid" aria-label="Mobile navigation">
        <MobileNavButton active={mobileScreen === "calendar"} icon={CalendarDays} label="Calendar" onClick={() => { setMobileScreen("calendar"); setTaskOverlay(false); }} />
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
