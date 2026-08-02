"use client";

import { CalendarDays, CheckCircle2, Clock3, Copy, Inbox, ListChecks, Loader2, Moon, MoreHorizontal, Plus, Settings, Sun, Trash2 } from "lucide-react";
import Link from "next/link";
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
import { copyText } from "@/lib/clipboard";
import { LIST_COLORS } from "@/lib/constants";
import { utcToLocalParts, zonedNow, dateKey } from "@/lib/dates/timezone";
import { absoluteInviteUrl } from "@/lib/invites";
import type { ListView, MemberView, TaskView, WorkspaceView } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AppSidebar({ workspace, members, lists, tasks, filter, onFilter, onAdd, onShowTasks, onNavigate }: {
  workspace: WorkspaceView;
  members: MemberView[];
  lists: ListView[];
  tasks: TaskView[];
  filter: TaskFilter;
  onFilter: (filter: TaskFilter) => void;
  onAdd: () => void;
  onShowTasks: () => void;
  onNavigate?: () => void;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();
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

  return (
    <>
      <div className="flex h-full min-h-0 flex-col gap-3.5 overflow-y-auto p-3">
        <div className="flex items-center justify-between px-1"><Brand /><Button variant="ghost" size="icon-sm" aria-label="Toggle dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{resolvedTheme === "dark" ? <Sun /> : <Moon />}</Button></div>
        <Button className="justify-start" onClick={onAdd}><Plus />Add item</Button>
        <nav className="grid gap-1" aria-label="Primary">
          <NavButton active={filter === "all"} icon={CalendarDays} label="Calendar" onClick={() => { onFilter("all"); onNavigate?.(); }} />
          <NavButton active={filter === "all"} icon={ListChecks} label="All incomplete" count={open.length} onClick={() => choose("all")} />
        </nav>
        <SidebarLabel>Smart views</SidebarLabel>
        <nav className="grid gap-1">
          <NavButton active={filter === "inbox"} icon={Inbox} label="Inbox" count={open.filter((task) => !task.listId).length} onClick={() => choose("inbox")} />
          <NavButton active={filter === "today"} icon={CalendarDays} label="Today" count={todayCount} onClick={() => choose("today")} />
          <NavButton active={filter === "upcoming"} icon={Clock3} label="Upcoming" count={upcomingCount} onClick={() => choose("upcoming")} />
          <NavButton active={filter === "completed"} icon={CheckCircle2} label="Completed" count={tasks.length - open.length} onClick={() => choose("completed")} />
        </nav>
        <div className="flex items-center justify-between"><SidebarLabel>Shared lists</SidebarLabel><Button variant="ghost" size="icon-sm" aria-label="Create list" onClick={() => setListDialog("new")}><Plus /></Button></div>
        <nav className="grid gap-1">{lists.map((list) => <div key={list.id} className="group flex items-center"><button onClick={() => choose(`list:${list.id}`)} className={cn("flex min-h-10 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 text-left text-sm hover:bg-secondary", filter === `list:${list.id}` && "bg-accent font-medium text-accent-foreground")}><span className="size-2.5 rounded-full" style={{ backgroundColor: list.color }} /><span className="truncate">{list.name}</span><span className="ml-auto text-xs text-muted-foreground">{open.filter((task) => task.listId === list.id).length}</span></button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Manage ${list.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="start"><DropdownMenuItem onClick={() => setListDialog(list)}>Rename & recolor</DropdownMenuItem><DropdownMenuItem variant="destructive" onClick={() => setDeleteList(list)}><Trash2 />Delete list</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>)}</nav>
        <div className="mt-auto grid w-full min-w-0 gap-2.5 overflow-hidden rounded-xl border bg-card p-3">
          <div className="flex min-w-0 items-center gap-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" title={workspace.name}>{workspace.name}</p><p className="truncate text-xs text-muted-foreground">{workspace.timezone}</p></div><div className="flex shrink-0 -space-x-2">{members.map((member, index) => <span key={member.userId} title={member.displayName} className={cn("grid size-8 place-items-center rounded-full border-2 border-card bg-blue-600 text-[10px] font-bold text-white", index === 1 && "bg-teal-700")}>{initials(member.displayName)}</span>)}</div></div>
          {members.length < 2 && <Button variant="outline" size="sm" className="w-full min-w-0" disabled={pending} onClick={copyInvite}>{pending ? <Loader2 className="animate-spin" /> : <Copy />}<span className="truncate">Copy invite link</span></Button>}
          <Button variant="ghost" size="sm" asChild className="w-full min-w-0 justify-start overflow-hidden"><Link href="/settings" onClick={onNavigate}><Settings /><span className="truncate">Workspace settings</span></Link></Button>
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
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>{value === "new" ? "Create shared list" : "Edit shared list"}</DialogTitle><DialogDescription>Lists are visible and editable by both members.</DialogDescription></DialogHeader><form action={submit} className="space-y-4"><div className="space-y-2"><Label htmlFor="list-name">Name</Label><Input id="list-name" name="name" defaultValue={value && value !== "new" ? value.name : ""} required /></div><div className="space-y-2"><Label htmlFor="list-color">Color</Label><Input id="list-color" name="color" type="color" className="h-11" defaultValue={value && value !== "new" ? value.color : LIST_COLORS[0]} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={pending}>{pending && <Loader2 className="animate-spin" />}Save</Button></DialogFooter></form></DialogContent></Dialog>;
}

function SidebarLabel({ children }: { children: React.ReactNode }) { return <div className="px-2 text-[11px] font-bold uppercase tracking-[.08em] text-muted-foreground">{children}</div>; }

function NavButton({ active, icon: Icon, label, count, onClick }: { active?: boolean; icon: React.ComponentType<{ className?: string }>; label: string; count?: number; onClick: () => void }) {
  return <button onClick={onClick} className={cn("flex min-h-10 items-center gap-2.5 rounded-lg px-2 text-sm hover:bg-secondary", active && "bg-accent font-medium text-accent-foreground")}><Icon className="size-4.5" /><span>{label}</span>{count !== undefined && <span className="ml-auto text-xs text-muted-foreground">{count}</span>}</button>;
}
