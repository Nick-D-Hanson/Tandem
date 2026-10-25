"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteTaskAction, saveTaskAction } from "@/lib/actions/items";
import { utcToLocalParts } from "@/lib/dates/timezone";
import { quadrantDetails, type PlannerQuadrant } from "@/lib/tasks/planner";
import type { ListView, MemberView, TaskView } from "@/lib/types";

export function PlannerTaskEditor({ task, open, timezone, lists, members, onOpenChange }: {
  task: TaskView | null;
  open: boolean;
  timezone: string;
  lists: ListView[];
  members: MemberView[];
  onOpenChange: (open: boolean) => void;
}) {
  if (!task || !open) return null;
  return <PlannerTaskEditorContent key={`${task.id}:${task.updatedAt}`} task={task} open={open} timezone={timezone} lists={lists} members={members} onOpenChange={onOpenChange} />;
}

function PlannerTaskEditorContent({ task, open, timezone, lists, members, onOpenChange }: {
  task: TaskView;
  open: boolean;
  timezone: string;
  lists: ListView[];
  members: MemberView[];
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const due = task.dueAt ? utcToLocalParts(task.dueAt, timezone) : null;

  function submit(formData: FormData) {
    setError("");
    const quadrantValue = String(formData.get("quadrant") || "");
    startTransition(async () => {
      const result = await saveTaskAction({
        id: task.id,
        title: String(formData.get("title") || ""),
        notes: String(formData.get("notes") || ""),
        scheduledDate: String(formData.get("scheduledDate") || ""),
        dueDate: String(formData.get("dueDate") || ""),
        dueTime: task.dueIsAllDay ? "" : due?.time ?? "",
        assigneeUserId: String(formData.get("assigneeUserId") || ""),
        listId: String(formData.get("listId") || ""),
        priority: task.priority,
        quadrant: quadrantValue ? Number(quadrantValue) as PlannerQuadrant : null,
        recurrence: task.recurrence,
      });
      if (!result.ok) { setError(result.error); return; }
      toast.success("Task updated", { description: String(formData.get("title") || "") });
      onOpenChange(false);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteTaskAction(task.id);
      if (!result.ok) { setError(result.error); return; }
      toast.success("Task deleted");
      setConfirmDelete(false);
      onOpenChange(false);
      router.refresh();
    });
  }

  return <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="task-workspace-theme max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white text-[#293044] sm:max-w-[540px]">
        <DialogHeader><DialogTitle>Edit task</DialogTitle><DialogDescription>Planned work and deadlines stay independent.</DialogDescription></DialogHeader>
        <form onSubmit={(event) => { event.preventDefault(); submit(new FormData(event.currentTarget)); }} className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <div className="col-span-full space-y-2"><Label htmlFor="planner-title">Task</Label><Input id="planner-title" name="title" autoFocus required maxLength={120} defaultValue={task.title} /></div>
          <div className="space-y-2"><Label htmlFor="planner-scheduled">Planned work date</Label><Input id="planner-scheduled" name="scheduledDate" type="date" defaultValue={task.scheduledDate ?? ""} /><p className="text-[11px] text-[#7c8290]">Leave blank to keep it in Backlog.</p></div>
          <div className="space-y-2"><Label htmlFor="planner-due">Due date</Label><Input id="planner-due" name="dueDate" type="date" defaultValue={due?.date ?? ""} /><p className="text-[11px] text-[#7c8290]">A deadline does not schedule the task.</p></div>
          <NativeSelect label="Eisenhower priority" name="quadrant" defaultValue={task.quadrant ? String(task.quadrant) : ""} options={[{ value: "", label: "Unclassified" }, ...([1, 2, 3, 4] as PlannerQuadrant[]).map((quadrant) => ({ value: String(quadrant), label: `Q${quadrant} · ${quadrantDetails[quadrant].action}` }))]} />
          <NativeSelect label="Category" name="listId" defaultValue={task.listId ?? ""} options={[{ value: "", label: "Inbox" }, ...lists.map((list) => ({ value: list.id, label: list.name }))]} />
          <NativeSelect label="Assignee" name="assigneeUserId" defaultValue={task.assigneeUserId ?? ""} options={[{ value: "", label: "Unassigned / shared" }, ...members.map((member) => ({ value: member.userId, label: member.displayName }))]} />
          <div className="col-span-full space-y-2"><Label htmlFor="planner-notes">Notes</Label><Textarea id="planner-notes" name="notes" defaultValue={task.notes ?? ""} placeholder="Optional details" /></div>
          {task.recurrence && <p className="col-span-full rounded-lg bg-[#f5f3fd] px-3 py-2 text-xs text-[#6557a7]">This task repeats. Its recurrence rule remains unchanged here; use the Calendar task editor to modify the series.</p>}
          {error && <p className="col-span-full text-sm text-destructive" role="alert">{error}</p>}
          <div className="col-span-full flex items-center justify-between gap-3 pt-2"><Button type="button" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 />Delete</Button><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={pending}>{pending && <Loader2 className="animate-spin" />}Save</Button></div></div>
        </form>
      </DialogContent>
    </Dialog>
    <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this task?</AlertDialogTitle><AlertDialogDescription>This removes it for everyone in the workspace and cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep it</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={remove}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}

function NativeSelect({ label, name, defaultValue, options }: { label: string; name: string; defaultValue: string; options: { value: string; label: string }[] }) {
  return <div className="space-y-2"><Label htmlFor={`planner-${name}`}>{label}</Label><select id={`planner-${name}`} name={name} defaultValue={defaultValue} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50">{options.map((option) => <option key={option.value || "empty"} value={option.value}>{option.label}</option>)}</select></div>;
}
