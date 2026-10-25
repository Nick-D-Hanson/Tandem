"use client";

import { CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Clock3, Copy, Inbox, ListChecks, Loader2, LogOut, Moon, MoreHorizontal, NotebookTabs, PanelLeftClose, Plus, Settings, Sun, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Brand } from "@/components/brand";
import { initials, type TaskFilter } from "@/components/tasks/task-panel";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createInviteAction } from "@/lib/actions/workspace";
import { deleteListAction, saveListAction } from "@/lib/actions/items";
import { authClient } from "@/lib/auth/client";
import { copyText } from "@/lib/clipboard";
import { LIST_COLORS } from "@/lib/constants";
import { utcToLocalParts, zonedNow, dateKey } from "@/lib/dates/timezone";
import { absoluteInviteUrl } from "@/lib/invites";
import type { ListView, MemberView, TaskView, WorkspaceView } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AppSidebar({ surface = "calendar", workspace, members, lists, tasks, filter, onFilter, onAdd, onShowTasks, onShowCalendar, onShowMyList, onNavigate, onCollapse }: {
  surface?: "calendar" | "tasks";
  workspace: WorkspaceView;
  members: MemberView[];
  lists: ListView[];
  tasks: TaskView[];
  filter: TaskFilter;
  onFilter: (filter: TaskFilter) => void;
  onAdd: () => void;
  onShowTasks: () => void;
  onShowCalendar?: () => void;
  onShowMyList?: () => void;
  onNavigate?: () => void;
  onCollapse?: () => void;
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();
  const [signOutPending, setSignOutPending] = useState(false);
  const [smartViewsOpen, setSmartViewsOpen] = useState(true);
  const [sharedListsOpen, setSharedListsOpen] = useState(true);
  const [listDialog, setListDialog] = useState<ListView | "new" | null>(null);
  const [deleteList, setDeleteList] = useState<ListView | null>(null);
  const today = dateKey(zonedNow(workspace.timezone));
  const open = tasks.filter((task) => !task.completedAt);
  const todayCount = open.filter((task) => task.dueAt && utcToLocalParts(task.dueAt, workspace.timezone).date === today).length;
  const upcomingCount = open.filter((task) => task.dueAt && utcToLocalParts(task.dueAt, workspace.timezone).date > today).length;

  function choose(next: TaskFilter) {
    onFilter(next);
    onShowTasks();
    onNavigate?.();
  }

  function copyInvite() {
    startTransition(async () => {
      const result = await createInviteAction();
      if (!result.ok) { toast.error(result.error); return; }
      const copied = await copyText(absoluteInviteUrl(result.data.invitePath, window.location.origin));
      if (copied) toast.success("Fresh invite link copied", { description: "It expires in seven days." });
      else toast.error("Clipboard access was blocked", { description: "Create the link from Settings → Members to copy it manually." });
    });
  }

  function removeList() {
    if (!deleteList) return;
    startTransition(async () => {
      const result = await deleteListAction(deleteList.id);
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(`${deleteList.name} deleted`, { description: "Its tasks moved to Inbox." });
      setDeleteList(null);
      if (filter === `list:${deleteList.id}`) onFilter("inbox");
    });
  }

  async function signOut() {
    setSignOutPending(true);
    await authClient.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col overflow-hidden p-3">
        <div className="flex min-h-9 shrink-0 items-center justify-between gap-1 px-1"><Brand /><div className="flex items-center gap-0.5"><Button variant="ghost" size="icon-sm" aria-label="Toggle dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{resolvedTheme === "dark" ? <Sun /> : <Moon />}</Button>{onCollapse && <Button variant="ghost" size="icon-sm" className="max-[820px]:hidden" aria-label="Hide navigation sidebar" onClick={onCollapse}><PanelLeftClose /></Button>}</div></div>
        <Button className="mt-3.5 shrink-0 justify-start" onClick={onAdd}><Plus />Add item</Button>
        <div className="mt-3.5 min-h-0 flex-1 space-y-3.5 overflow-y-auto overscroll-contain pr-1">
          <nav className="grid gap-1" aria-label="Primary">
            <NavButton active={surface === "calendar"} icon={CalendarDays} label="Calendar" onClick={() => { onFilter("all"); onShowCalendar?.(); onNavigate?.(); }} />
            <NavButton active={surface === "tasks"} icon={NotebookTabs} label="My List" onClick={() => { onShowMyList?.(); onNavigate?.(); }} />
            <NavButton active={surface === "calendar" && filter === "all"} icon={ListChecks} label="All incomplete" count={open.length} onClick={() => choose("all")} />
          </nav>
          <SidebarSectionToggle label="Smart Views" open={smartViewsOpen} onToggle={() => setSmartViewsOpen((open) => !open)} />
          {smartViewsOpen && <nav className="grid gap-1">
            <NavButton active={filter === "inbox"} icon={Inbox} label="Inbox" count={open.filter((task) => !task.listId).length} onClick={() => choose("inbox")} />
            <NavButton active={filter === "today"} icon={CalendarDays} label="Today" count={todayCount} onClick={() => choose("today")} />
            <NavButton active={filter === "upcoming"} icon={Clock3} label="Upcoming" count={upcomingCount} onClick={() => choose("upcoming")} />
            <NavButton active={filter === "completed"} icon={CheckCircle2} label="Completed" count={tasks.length - open.length} onClick={() => choose("completed")} />
          </nav>}
          <div className="flex items-center justify-between"><SidebarSectionToggle label="Shared Lists" open={sharedListsOpen} onToggle={() => setSharedListsOpen((open) => !open)} /><Button variant="ghost" size="icon-sm" aria-label="Create list" onClick={() => setListDialog("new")}><Plus /></Button></div>
          {sharedListsOpen && <nav className="grid gap-1">{lists.map((list) => <div key={list.id} className="group flex items-center"><button onClick={() => choose(`list:${list.id}`)} className={cn("flex min-h-10 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 text-left text-sm hover:bg-secondary", filter === `list:${list.id}` && "bg-accent font-medium text-accent-foreground")}><span className="size-2.5 rounded-full" style={{ backgroundColor: list.color }} /><span className="truncate">{list.name}</span><span className="ml-auto text-xs text-muted-foreground">{open.filter((task) => task.listId === list.id).length}</span></button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Manage ${list.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="start"><DropdownMenuItem onClick={() => setListDialog(list)}>Rename & recolor</DropdownMenuItem><DropdownMenuItem variant="destructive" onClick={() => setDeleteList(list)}><Trash2 />Delete list</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>)}</nav>}
        </div>
        <div className="mt-3.5 grid w-full min-w-0 shrink-0 gap-2.5 overflow-hidden rounded-xl border bg-card p-3">
          <div className="flex min-w-0 items-center gap-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" title={workspace.name}>{workspace.name}</p><p className="truncate text-xs text-muted-foreground">{workspace.timezone}</p></div><div className="flex shrink-0 -space-x-2">{members.slice(0, 4).map((member, index) => <span key={member.userId} title={member.displayName} className={cn("grid size-8 place-items-center rounded-full border-2 border-card text-[10px] font-bold text-white", memberAvatarClass(index))}>{initials(member.displayName)}</span>)}{members.length > 4 && <span title={`${members.length - 4} more members`} className="grid size-8 place-items-center rounded-full border-2 border-card bg-slate-700 text-[9px] font-bold text-white">+{members.length - 4}</span>}</div></div>
          <Button variant="outline" size="sm" className="w-full min-w-0 justify-start overflow-hidden" disabled={pending} onClick={copyInvite}>{pending ? <Loader2 className="animate-spin" /> : <Copy />}<span className="truncate">Copy Invite Link</span></Button>
          <Button variant="ghost" size="sm" asChild className="w-full min-w-0 justify-start overflow-hidden"><Link href="/settings" onClick={onNavigate}><Settings /><span className="truncate">Workspace Settings</span></Link></Button>
          <Button variant="ghost" size="sm" className="w-full min-w-0 justify-start overflow-hidden text-muted-foreground hover:text-foreground" disabled={signOutPending} onClick={signOut}>{signOutPending ? <Loader2 className="animate-spin" /> : <LogOut />}<span className="truncate">Sign Out</span></Button>
        </div>
      </div>
      <ListDialog value={listDialog} open={Boolean(listDialog)} onOpenChange={(open) => !open && setListDialog(null)} />
      <AlertDialog open={Boolean(deleteList)} onOpenChange={(open) => !open && setDeleteList(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {deleteList?.name}?</AlertDialogTitle><AlertDialogDescription>Tasks in this list will move to Inbox. No tasks will be deleted.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={removeList}>Delete list</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}

function ListDialog({ value, open, onOpenChange }: { value: ListView | "new" | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [pending, startTransition] = useTransition();
  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await saveListAction({ id: value && value !== "new" ? value.id : undefined, name: String(formData.get("name") || ""), color: String(formData.get("color") || LIST_COLORS[0]) });
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(value === "new" ? "List created" : "List updated");
      onOpenChange(false);
    });
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>{value === "new" ? "Create shared list" : "Edit shared list"}</DialogTitle><DialogDescription>Lists are visible and editable by everyone in the workspace.</DialogDescription></DialogHeader><form action={submit} className="space-y-4"><div className="space-y-2"><Label htmlFor="list-name">Name</Label><Input id="list-name" name="name" defaultValue={value && value !== "new" ? value.name : ""} required /></div><div className="space-y-2"><Label htmlFor="list-color">Color</Label><Input id="list-color" name="color" type="color" className="h-11" defaultValue={value && value !== "new" ? value.color : LIST_COLORS[0]} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={pending}>{pending && <Loader2 className="animate-spin" />}Save</Button></DialogFooter></form></DialogContent></Dialog>;
}

function memberAvatarClass(index: number) {
  return ["bg-blue-600", "bg-teal-700", "bg-violet-600", "bg-amber-600"][index % 4];
}

function SidebarSectionToggle({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  const Icon = open ? ChevronDown : ChevronRight;
  return <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-h-8 flex-1 items-center gap-1 rounded-md px-2 text-left text-[11px] font-bold uppercase tracking-[.08em] text-muted-foreground hover:bg-secondary hover:text-foreground"><Icon className="size-3.5" /><span>{label}</span></button>;
}

function NavButton({ active, icon: Icon, label, count, onClick }: { active?: boolean; icon: React.ComponentType<{ className?: string }>; label: string; count?: number; onClick: () => void }) {
  return <button onClick={onClick} className={cn("flex min-h-10 items-center gap-2.5 rounded-lg px-2 text-sm hover:bg-secondary", active && "bg-accent font-medium text-accent-foreground")}><Icon className="size-4.5" /><span>{label}</span>{count !== undefined && <span className="ml-auto text-xs text-muted-foreground">{count}</span>}</button>;
}
