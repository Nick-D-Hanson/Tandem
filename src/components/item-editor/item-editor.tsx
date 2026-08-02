"use client";

import { format } from "date-fns";
import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { deleteEventAction, deleteTaskAction, saveEventAction, saveTaskAction } from "@/lib/actions/items";
import { EVENT_COLORS } from "@/lib/constants";
import { dateKey, utcToLocalParts } from "@/lib/dates/timezone";
import type { CalendarSelection } from "@/components/calendar/calendar-view";
import type { EventView, ListView, MemberView, TaskView } from "@/lib/types";

export function ItemEditor({ open, selection, timezone, tasks, events, lists, members, onOpenChange }: {
  open: boolean;
  selection: CalendarSelection | null;
  timezone: string;
  tasks: TaskView[];
  events: EventView[];
  lists: ListView[];
  members: MemberView[];
  onOpenChange: (open: boolean) => void;
}) {
  if (!open || !selection) return null;
  const editorKey = `${selection.type}:${selection.id ?? "new"}:${selection.date ?? ""}:${selection.time ?? ""}`;
  return <ItemEditorContent key={editorKey} open={open} selection={selection} timezone={timezone} tasks={tasks} events={events} lists={lists} members={members} onOpenChange={onOpenChange} />;
}

function ItemEditorContent({ open, selection, timezone, tasks, events, lists, members, onOpenChange }: {
  open: boolean;
  selection: CalendarSelection;
  timezone: string;
  tasks: TaskView[];
  events: EventView[];
  lists: ListView[];
  members: MemberView[];
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [type, setType] = useState<"event" | "task">(selection.type);
  const initialTask = selection.type === "task" && selection.id ? tasks.find((item) => item.id === selection.id) : undefined;
  const initialEvent = selection.type === "event" && selection.id ? events.find((item) => item.id === selection.id) : undefined;
  const [title, setTitle] = useState(initialTask?.title ?? initialEvent?.title ?? "");
  const [allDay, setAllDay] = useState(initialEvent?.allDay ?? false);
  const [error, setError] = useState("");
  const task = useMemo(() => selection.type === "task" && selection.id ? tasks.find((item) => item.id === selection.id) : undefined, [selection, tasks]);
  const event = useMemo(() => selection.type === "event" && selection.id ? events.find((item) => item.id === selection.id) : undefined, [selection, events]);
  const isEditing = Boolean(task || event);

  const fallbackDate = selection.date ?? dateKey(new Date());
  const eventParts = event ? utcToLocalParts(event.startAt, timezone) : null;
  const eventEndParts = event ? utcToLocalParts(event.endAt, timezone) : null;
  const taskParts = task?.dueAt ? utcToLocalParts(task.dueAt, timezone) : null;
  const creator = members.find((member) => member.userId === (task?.createdBy ?? event?.createdBy));
  const updater = members.find((member) => member.userId === (task?.updatedBy ?? event?.updatedBy));

  function submit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = type === "event"
        ? await saveEventAction({
            id: event?.id,
            title,
            date: String(formData.get("date") || ""),
            allDay,
            startTime: String(formData.get("startTime") || "") || undefined,
            endTime: String(formData.get("endTime") || "") || undefined,
            description: String(formData.get("description") || ""),
            location: String(formData.get("location") || ""),
            color: String(formData.get("color") || "blue"),
            recurrence: String(formData.get("recurrence") || "none"),
          })
        : await saveTaskAction({
            id: task?.id,
            title,
            notes: String(formData.get("notes") || ""),
            dueDate: String(formData.get("dueDate") || ""),
            dueTime: String(formData.get("dueTime") || ""),
            assigneeUserId: String(formData.get("assigneeUserId") || ""),
            listId: String(formData.get("listId") || ""),
            priority: String(formData.get("priority") || "none"),
          });
      if (!result.ok) return setError(result.error);
      toast.success(`${type === "event" ? "Event" : "Task"} saved`, { description: title });
      onOpenChange(false);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = type === "event" && event ? await deleteEventAction(event.id) : task ? await deleteTaskAction(task.id) : null;
      if (!result?.ok) return setError(result?.error ?? "Item not found.");
      toast.success(`${type === "event" ? "Event" : "Task"} deleted`);
      setConfirmDelete(false);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[560px] max-sm:top-auto max-sm:bottom-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:border-b-0">
          <DialogHeader><DialogTitle>{isEditing ? `Edit ${type}` : "Add item"}</DialogTitle><DialogDescription>Shared with both workspace members.</DialogDescription></DialogHeader>
          <Tabs value={type} onValueChange={(value) => setType(value as "event" | "task")}><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="event" disabled={isEditing && type === "task"}>Event</TabsTrigger><TabsTrigger value="task" disabled={isEditing && type === "event"}>Task</TabsTrigger></TabsList></Tabs>
          <form action={submit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="item-title">Title</Label><Input id="item-title" name="title" autoFocus required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={type === "event" ? "What’s happening?" : "What needs to be done?"} /></div>
            {type === "event" ? (
              <EventFields event={event} eventParts={eventParts} eventEndParts={eventEndParts} fallbackDate={fallbackDate} fallbackTime={selection?.time} allDay={allDay} setAllDay={setAllDay} />
            ) : (
              <TaskFields task={task} taskParts={taskParts} fallbackDate={selection?.date} lists={lists} members={members} />
            )}
            {isEditing && <p className="text-xs text-muted-foreground">Created by {creator?.displayName ?? "a member"} · Last updated by {updater?.displayName ?? "a member"} {format(new Date(task?.updatedAt ?? event!.updatedAt), "MMM d, yyyy 'at' h:mm a")}</p>}
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <div className="flex items-center justify-between gap-3 pt-2">
              {isEditing ? <Button type="button" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 />Delete</Button> : <span />}
              <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={pending || !title.trim()}>{pending && <Loader2 className="animate-spin" />}Save</Button></div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this {type}?</AlertDialogTitle><AlertDialogDescription>This removes it for both workspace members and can’t be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep it</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={remove}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}

function EventFields({ event, eventParts, eventEndParts, fallbackDate, fallbackTime, allDay, setAllDay }: {
  event?: EventView;
  eventParts: { date: string; time: string } | null;
  eventEndParts: { date: string; time: string } | null;
  fallbackDate: string;
  fallbackTime?: string;
  allDay: boolean;
  setAllDay: (value: boolean) => void;
}) {
  const start = fallbackTime ?? "09:00";
  const endHour = Math.min(Number(start.slice(0, 2)) + 1, 23);
  return <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
    <div className="space-y-2"><Label htmlFor="event-date">Date</Label><Input id="event-date" name="date" type="date" required defaultValue={eventParts?.date ?? fallbackDate} /></div>
    <div className="flex items-end pb-2"><Label className="flex min-h-10 cursor-pointer items-center gap-2"><Checkbox checked={allDay} onCheckedChange={(checked) => setAllDay(Boolean(checked))} />All day</Label></div>
    {!allDay && <><div className="space-y-2"><Label htmlFor="start-time">Starts</Label><Input id="start-time" name="startTime" type="time" required defaultValue={eventParts?.time ?? start} /></div><div className="space-y-2"><Label htmlFor="end-time">Ends</Label><Input id="end-time" name="endTime" type="time" required defaultValue={eventEndParts?.time ?? `${String(endHour).padStart(2, "0")}:00`} /></div></>}
    <div className="space-y-2"><Label htmlFor="location">Location</Label><Input id="location" name="location" defaultValue={event?.location ?? ""} placeholder="Optional" /></div>
    <SelectField label="Repeats" name="recurrence" defaultValue={event?.recurrence ?? "none"} options={[{ value: "none", label: "Never" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]} />
    <SelectField label="Color" name="color" defaultValue={event?.color ?? "blue"} options={EVENT_COLORS.map((item) => ({ value: item.value, label: item.label }))} />
    <div className="col-span-full space-y-2"><Label htmlFor="description">Details</Label><Textarea id="description" name="description" defaultValue={event?.description ?? ""} placeholder="Optional notes" /></div>
  </div>;
}

function TaskFields({ task, taskParts, fallbackDate, lists, members }: { task?: TaskView; taskParts: { date: string; time: string } | null; fallbackDate?: string; lists: ListView[]; members: MemberView[] }) {
  return <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
    <div className="space-y-2"><Label htmlFor="due-date">Due date</Label><Input id="due-date" name="dueDate" type="date" defaultValue={taskParts?.date ?? fallbackDate ?? ""} /></div>
    <div className="space-y-2"><Label htmlFor="due-time">Due time</Label><Input id="due-time" name="dueTime" type="time" defaultValue={!task?.dueIsAllDay ? taskParts?.time : ""} /></div>
    <SelectField label="List" name="listId" defaultValue={task?.listId ?? "inbox"} options={[{ value: "inbox", label: "Inbox" }, ...lists.map((list) => ({ value: list.id, label: list.name }))]} transformValue={(value) => value === "inbox" ? "" : value} />
    <SelectField label="Assignee" name="assigneeUserId" defaultValue={task?.assigneeUserId ?? "unassigned"} options={[{ value: "unassigned", label: "Unassigned / shared" }, ...members.map((member) => ({ value: member.userId, label: member.displayName }))]} transformValue={(value) => value === "unassigned" ? "" : value} />
    <SelectField label="Priority" name="priority" defaultValue={task?.priority ?? "none"} options={[{ value: "none", label: "None" }, { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }]} />
    <div className="col-span-full space-y-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" name="notes" defaultValue={task?.notes ?? ""} placeholder="Optional notes" /></div>
  </div>;
}

function SelectField({ label, name, defaultValue, options, transformValue }: { label: string; name: string; defaultValue: string; options: { value: string; label: string }[]; transformValue?: (value: string) => string }) {
  const [value, setValue] = useState(defaultValue);
  return <div className="space-y-2"><Label>{label}</Label><input type="hidden" name={name} value={transformValue ? transformValue(value) : value} /><Select value={value} onValueChange={setValue}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>;
}
