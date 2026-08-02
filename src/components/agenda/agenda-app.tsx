"use client";

import { CalendarDays, ListChecks, Menu, NotebookTabs, PanelLeftOpen, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AgendaView } from "@/components/agenda/agenda-view";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import type { CalendarSelection } from "@/components/calendar/calendar-view";
import { ItemEditor } from "@/components/item-editor/item-editor";
import { TaskPanel, type TaskFilter } from "@/components/tasks/task-panel";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { AgendaData, AppData } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AgendaApp({ appData, agendaData }: { appData: AppData; agendaData: AgendaData }) {
  const router = useRouter();
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [taskSidebarOpen, setTaskSidebarOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selection, setSelection] = useState<CalendarSelection | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const desktopGrid = leftSidebarOpen ? (taskSidebarOpen ? "grid-cols-[236px_minmax(0,1fr)_340px]" : "grid-cols-[236px_minmax(0,1fr)]") : (taskSidebarOpen ? "grid-cols-[44px_minmax(0,1fr)_340px]" : "grid-cols-[44px_minmax(0,1fr)]");
  const tabletGrid = leftSidebarOpen ? "max-[1180px]:grid-cols-[220px_minmax(0,1fr)]" : "max-[1180px]:grid-cols-[44px_minmax(0,1fr)]";

  function openTaskEditor(id?: string) {
    setSelection({ type: "task", ...(id ? { id } : {}) });
    setEditorOpen(true);
  }

  function showTasks() {
    setTaskSidebarOpen(true);
    setMobileNavOpen(false);
  }

  const sidebar = <AppSidebar surface="agenda" workspace={appData.workspace} members={appData.members} lists={appData.lists} tasks={appData.tasks} filter={filter} onFilter={setFilter} onAdd={() => openTaskEditor()} onShowTasks={showTasks} onShowCalendar={() => router.push("/app")} onShowAgenda={() => setMobileNavOpen(false)} onNavigate={() => setMobileNavOpen(false)} onCollapse={() => setLeftSidebarOpen(false)} />;

  return <main className={cn("grid h-dvh overflow-hidden bg-background max-[820px]:block", desktopGrid, tabletGrid)} data-testid="my-list-app">
    <aside className="min-h-0 border-r bg-card/95 max-[820px]:hidden" aria-label="Primary navigation">{leftSidebarOpen ? sidebar : <div className="flex h-[62px] items-center justify-center border-b"><Button variant="ghost" size="icon-sm" aria-label="Show navigation sidebar" onClick={() => setLeftSidebarOpen(true)}><PanelLeftOpen /></Button></div>}</aside>
    <section className="flex h-dvh min-h-0 min-w-0 flex-col bg-card max-[820px]:pb-[66px]">
      <header className="flex h-[62px] shrink-0 items-center gap-3 border-b px-4 max-[820px]:h-[58px] max-[820px]:px-2.5">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="hidden max-[820px]:inline-flex" aria-label="Open navigation"><Menu /></Button></SheetTrigger><SheetContent side="left" className="w-[300px] p-0"><SheetHeader className="sr-only"><SheetTitle>Navigation</SheetTitle><SheetDescription>Workspace navigation</SheetDescription></SheetHeader>{sidebar}</SheetContent></Sheet>
        <NotebookTabs className="size-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><h1 className="truncate text-lg font-semibold tracking-tight">My List</h1><p className="truncate text-xs text-muted-foreground">Private by default · {agendaData.workspaceTimezone}</p></div>
        <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => router.push("/app")}><CalendarDays /><span className="max-[500px]:sr-only">Calendar</span></Button>
        <Button type="button" variant={taskSidebarOpen ? "secondary" : "ghost"} size="sm" className="shrink-0" aria-pressed={taskSidebarOpen} onClick={() => setTaskSidebarOpen((open) => !open)}><ListChecks /><span className="max-[500px]:sr-only">Tasks</span></Button>
      </header>
      <AgendaView key={agendaData.agendas.map((agenda) => `${agenda.ownerUserId}:${agenda.visibleDays}:${agenda.isShared}:${agenda.days.flatMap((day) => day.items.map((item) => `${item.id}:${item.updatedAt}:${item.date}:${item.position}`)).join(",")}`).join("|")} data={agendaData} />
    </section>
    {taskSidebarOpen && <TaskPanel tasks={appData.tasks} lists={appData.lists} members={appData.members} timezone={appData.workspace.timezone} filter={filter} onEdit={openTaskEditor} onAdd={() => openTaskEditor()} onClose={() => setTaskSidebarOpen(false)} className="min-[1181px]:flex max-[1180px]:fixed max-[1180px]:bottom-0 max-[1180px]:right-0 max-[1180px]:top-[62px] max-[1180px]:z-40 max-[1180px]:flex max-[1180px]:w-[min(360px,calc(100vw-44px))] max-[1180px]:shadow-2xl max-[820px]:top-[58px] max-[820px]:bottom-[66px] max-[820px]:w-full max-[820px]:border-l-0" />}
    <nav className="fixed inset-x-0 bottom-0 z-30 hidden h-[66px] grid-cols-4 border-t bg-card/95 px-3 pb-[max(5px,env(safe-area-inset-bottom))] pt-1 backdrop-blur max-[820px]:grid" aria-label="Mobile navigation">
      <MobileLink icon={CalendarDays} label="Calendar" onClick={() => router.push("/app")} />
      <MobileLink active={!taskSidebarOpen} icon={NotebookTabs} label="My List" onClick={() => setTaskSidebarOpen(false)} />
      <MobileLink icon={Plus} label="Add" onClick={() => openTaskEditor()} />
      <MobileLink active={taskSidebarOpen} icon={ListChecks} label="Tasks" onClick={() => setTaskSidebarOpen(true)} />
    </nav>
    <ItemEditor open={editorOpen} selection={selection} timezone={appData.workspace.timezone} tasks={appData.tasks} events={appData.events} lists={appData.lists} members={appData.members} onOpenChange={setEditorOpen} onTaskCreated={showTasks} />
  </main>;
}

function MobileLink({ active, icon: Icon, label, onClick }: { active?: boolean; icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("grid min-h-11 place-items-center content-center gap-0.5 rounded-lg text-[10px] text-muted-foreground", active && "text-primary")}><Icon className="size-5" /><span>{label}</span></button>;
}
