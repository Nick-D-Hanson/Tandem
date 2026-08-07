"use client";

import { addDays, format } from "date-fns";
import { CalendarDays, ListChecks, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { deleteEventAction, deleteTaskAction, saveEventAction, saveTaskAction } from "@/lib/actions/items";
import { dateKey, localDate, utcToLocalParts } from "@/lib/dates/timezone";
import { normalizeRecurrenceInterval, recurrenceIntervalDigits, type RecurrenceFrequency, type RecurrenceRule } from "@/lib/recurrence";
import type { CalendarSelection } from "@/components/calendar/calendar-view";
import type { EventView, ListView, MemberView, TaskView } from "@/lib/types";

export function ItemEditor({ open, selection, timezone, tasks, events, lists, members, onOpenChange, onTaskCreated }: {
  open: boolean;
  selection: CalendarSelection | null;
  timezone: string;
  tasks: TaskView[];
  events: EventView[];
  lists: ListView[];
  members: MemberView[];
  onOpenChange: (open: boolean) => void;
  onTaskCreated?: () => void;
}) {
  if (!open || !selection) return null;
  const editorKey = `${selection.type}:${selection.id ?? "new"}:${selection.date ?? ""}:${selection.time ?? ""}`;
  return <ItemEditorContent key={editorKey} open={open} selection={selection} timezone={timezone} tasks={tasks} events={events} lists={lists} members={members} onOpenChange={onOpenChange} onTaskCreated={onTaskCreated} />;
}

function ItemEditorContent({ open, selection, timezone, tasks, events, lists, members, onOpenChange, onTaskCreated }: {
  open: boolean;
  selection: CalendarSelection;
  timezone: string;
  tasks: TaskView[];
  events: EventView[];
  lists: ListView[];
  members: MemberView[];
  onOpenChange: (open: boolean) => void;
  onTaskCreated?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [type, setType] = useState<"event" | "task">(selection.type);
  const initialTask = selection.type === "task" && selection.id ? tasks.find((item) => item.id === selection.id) : undefined;
  const initialEvent = selection.type === "event" && selection.id ? events.find((item) => item.id === selection.id) : undefined;
  const [title, setTitle] = useState(initialTask?.title ?? initialEvent?.title ?? "");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const task = useMemo(() => selection.type === "task" && selection.id ? tasks.find((item) => item.id === selection.id) : undefined, [selection, tasks]);
  const event = useMemo(() => selection.type === "event" && selection.id ? events.find((item) => item.id === selection.id) : undefined, [selection, events]);
  const isEditing = Boolean(task || event);

  const fallbackDate = selection.date ?? dateKey(new Date());
  const eventParts = event ? utcToLocalParts(event.startAt, timezone) : null;
  const eventEndParts = event ? utcToLocalParts(event.endAt, timezone) : null;
  const eventEndDate = eventEndParts ? (event?.allDay ? dateKey(addDays(localDate(eventEndParts.date), -1)) : eventEndParts.date) : null;
  const taskParts = task?.dueAt ? utcToLocalParts(task.dueAt, timezone) : null;
  const creator = members.find((member) => member.userId === (task?.createdBy ?? event?.createdBy));
  const updater = members.find((member) => member.userId === (task?.updatedBy ?? event?.updatedBy));

  function submit(formData: FormData) {
    setError("");
    setFieldErrors({});
    startTransition(async () => {
      const result = type === "event"
        ? await saveEventAction({
            id: event?.id,
            title,
            date: String(formData.get("date") || ""),
            endDate: String(formData.get("endDate") || ""),
            allDay: !formData.get("startTime") && !formData.get("endTime"),
            startTime: String(formData.get("startTime") || ""),
            endTime: String(formData.get("endTime") || ""),
            description: String(formData.get("description") || ""),
            location: String(formData.get("location") || ""),
            listId: String(formData.get("listId") || ""),
            recurrence: recurrenceFromFormData(formData),
          })
        : await saveTaskAction({
            id: task?.id,
            title,
            notes: String(formData.get("notes") || ""),
            dueDate: String(formData.get("dueDate") || ""),
            assigneeUserId: String(formData.get("assigneeUserId") || ""),
            listId: String(formData.get("listId") || ""),
            priority: String(formData.get("priority") || "none"),
          });
      if (!result.ok) {
        const nextFieldErrors = result.fieldErrors ?? {};
        setFieldErrors(nextFieldErrors);
        setError(Object.values(nextFieldErrors).flat()[0] ?? result.error);
        return;
      }
      toast.success(`${type === "event" ? "Event" : "Task"} saved`, { description: title });
      if (type === "task" && !task) onTaskCreated?.();
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
          <DialogHeader><DialogTitle>{isEditing ? `Edit ${type}` : "Add item"}</DialogTitle><DialogDescription>Shared with everyone in this workspace.</DialogDescription></DialogHeader>
          <Tabs value={type} onValueChange={(value) => setType(value as "event" | "task")}>
            <TabsList className="grid h-11 w-full grid-cols-2 gap-2 bg-transparent p-0">
              <TabsTrigger value="event" disabled={isEditing && type === "task"} className="h-full rounded-lg border bg-background text-sm font-semibold data-[state=active]:border-event data-[state=active]:bg-event data-[state=active]:text-white data-[state=active]:shadow-md dark:data-[state=active]:text-slate-950"><CalendarDays className="size-4" />Event</TabsTrigger>
              <TabsTrigger value="task" disabled={isEditing && type === "event"} className="h-full rounded-lg border bg-background text-sm font-semibold data-[state=active]:border-task data-[state=active]:bg-task data-[state=active]:text-white data-[state=active]:shadow-md dark:data-[state=active]:text-slate-950"><ListChecks className="size-4" />Task</TabsTrigger>
            </TabsList>
          </Tabs>
          <form onSubmit={(event) => { event.preventDefault(); submit(new FormData(event.currentTarget)); }} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="item-title">Title</Label><Input id="item-title" name="title" autoFocus required maxLength={120} aria-invalid={Boolean(fieldErrors.title)} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={type === "event" ? "What’s happening?" : "What needs to be done?"} /></div>
            {type === "event" ? (
              <EventFields event={event} eventParts={eventParts} eventEndParts={eventEndParts} eventEndDate={eventEndDate} fallbackDate={fallbackDate} lists={lists} fieldErrors={fieldErrors} />
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
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this {type}?</AlertDialogTitle><AlertDialogDescription>This removes it for everyone in the workspace and can’t be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep it</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={remove}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}

function EventFields({ event, eventParts, eventEndParts, eventEndDate, fallbackDate, lists, fieldErrors }: {
  event?: EventView;
  eventParts: { date: string; time: string } | null;
  eventEndParts: { date: string; time: string } | null;
  eventEndDate: string | null;
  fallbackDate: string;
  lists: ListView[];
  fieldErrors: Record<string, string[]>;
}) {
  const [startDate, setStartDate] = useState(eventParts?.date ?? fallbackDate);
  const [endDate, setEndDate] = useState(eventEndDate ?? fallbackDate);

  function changeStartDate(next: string) {
    setStartDate(next);
    if (endDate < next) setEndDate(next);
  }

  return <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
    <div className="space-y-2"><Label htmlFor="event-date">Start date</Label><Input id="event-date" name="date" type="date" required aria-invalid={Boolean(fieldErrors.date)} value={startDate} onChange={(event) => changeStartDate(event.target.value)} /></div>
    <div className="space-y-2"><Label htmlFor="event-end-date">End date</Label><Input id="event-end-date" name="endDate" type="date" required min={startDate} aria-invalid={Boolean(fieldErrors.endDate)} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div>
    <div className="space-y-2"><Label htmlFor="event-start-time">Start time <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="event-start-time" name="startTime" type="time" aria-invalid={Boolean(fieldErrors.startTime)} defaultValue={event && !event.allDay ? eventParts?.time ?? "" : ""} /></div>
    <div className="space-y-2"><Label htmlFor="event-end-time">End time <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="event-end-time" name="endTime" type="time" aria-invalid={Boolean(fieldErrors.endTime)} defaultValue={event && !event.allDay ? eventEndParts?.time ?? "" : ""} /></div>
    <p className="col-span-full -mt-2 text-xs text-muted-foreground">Leave both times empty for an all-day event.</p>
    <div className="space-y-2"><Label htmlFor="location">Location</Label><Input id="location" name="location" defaultValue={event?.location ?? ""} placeholder="Optional" /></div>
    <SelectField label="Category" name="listId" defaultValue={event?.listId ?? "uncategorized"} options={[{ value: "uncategorized", label: "Uncategorized", color: "#64748b" }, ...lists.map((list) => ({ value: list.id, label: list.name, color: list.color }))]} transformValue={(value) => value === "uncategorized" ? "" : value} />
    <RecurrenceFields rule={event?.recurrence ?? null} baseDate={eventParts?.date ?? fallbackDate} error={fieldErrors.recurrence?.[0]} />
    <div className="col-span-full space-y-2"><Label htmlFor="description">Details</Label><Textarea id="description" name="description" defaultValue={event?.description ?? ""} placeholder="Optional notes" /></div>
  </div>;
}

function TaskFields({ task, taskParts, fallbackDate, lists, members }: { task?: TaskView; taskParts: { date: string; time: string } | null; fallbackDate?: string; lists: ListView[]; members: MemberView[] }) {
  return <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
    <div className="col-span-full space-y-2"><Label htmlFor="due-date">Due date</Label><Input id="due-date" name="dueDate" type="date" defaultValue={taskParts?.date ?? fallbackDate ?? ""} /></div>
    <SelectField label="Category" name="listId" defaultValue={task?.listId ?? "inbox"} options={[{ value: "inbox", label: "Inbox", color: "#64748b" }, ...lists.map((list) => ({ value: list.id, label: list.name, color: list.color }))]} transformValue={(value) => value === "inbox" ? "" : value} />
    <SelectField label="Assignee" name="assigneeUserId" defaultValue={task?.assigneeUserId ?? "unassigned"} options={[{ value: "unassigned", label: "Unassigned / shared" }, ...members.map((member) => ({ value: member.userId, label: member.displayName }))]} transformValue={(value) => value === "unassigned" ? "" : value} />
    <SelectField label="Priority" name="priority" defaultValue={task?.priority ?? "none"} options={[{ value: "none", label: "None" }, { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }]} />
    <div className="col-span-full space-y-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" name="notes" defaultValue={task?.notes ?? ""} placeholder="Optional notes" /></div>
  </div>;
}

const weekdayOptions = [
  { value: 0, label: "S" }, { value: 1, label: "M" }, { value: 2, label: "T" }, { value: 3, label: "W" },
  { value: 4, label: "T" }, { value: 5, label: "F" }, { value: 6, label: "S" },
];

function recurrenceFromFormData(formData: FormData): RecurrenceRule | null {
  const frequency = String(formData.get("recurrenceFrequency") || "none");
  if (frequency === "none") return null;
  const interval = normalizeRecurrenceInterval(String(formData.get("recurrenceInterval") || ""));
  const weekdays = String(formData.get("recurrenceWeekdays") || "").split(",").filter(Boolean).map(Number);
  const until = String(formData.get("recurrenceUntil") || "");
  return {
    frequency: frequency as RecurrenceFrequency,
    interval,
    ...(frequency === "weekly" && weekdays.length ? { weekdays } : {}),
    ...(until ? { until } : {}),
  };
}

function RecurrenceFields({ rule, baseDate, error }: { rule: RecurrenceRule | null; baseDate: string; error?: string }) {
  type RecurrencePreset = RecurrenceFrequency | "none" | "custom";
  const simplePreset: RecurrencePreset = rule && rule.interval === 1 && !rule.weekdays?.length && !rule.until ? rule.frequency : rule ? "custom" : "none";
  const [preset, setPreset] = useState<RecurrencePreset>(simplePreset);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(rule?.frequency ?? "weekly");
  const [intervalInput, setIntervalInput] = useState(String(rule?.interval ?? 1));
  const [weekdays, setWeekdays] = useState<number[]>(rule?.weekdays?.length ? rule.weekdays : [new Date(`${baseDate}T12:00:00`).getDay()]);
  const [until, setUntil] = useState(rule?.until ?? "");
  const activeFrequency = preset === "custom" ? frequency : preset;
  const interval = normalizeRecurrenceInterval(intervalInput);
  const activeInterval = preset === "custom" ? interval : 1;

  function toggleWeekday(day: number) {
    setWeekdays((current) => current.includes(day) ? (current.length === 1 ? current : current.filter((value) => value !== day)) : [...current, day].sort());
  }

  function adjustInterval(amount: number) {
    setIntervalInput(String(Math.max(1, Math.min(99, interval + amount))));
  }

  return <div className={`col-span-full space-y-3 rounded-xl border bg-secondary/25 p-3 ${error ? "border-destructive" : ""}`} aria-invalid={Boolean(error)}>
    <div className="space-y-2"><Label>Repeats</Label><Select value={preset} onValueChange={(value) => setPreset(value as RecurrencePreset)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>
      <SelectItem value="none">Never</SelectItem><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="yearly">Annually</SelectItem><SelectItem value="custom">Custom…</SelectItem>
    </SelectContent></Select></div>
    <input type="hidden" name="recurrenceFrequency" value={activeFrequency} />
    <input type="hidden" name="recurrenceInterval" value={activeInterval} />
    <input type="hidden" name="recurrenceWeekdays" value={preset === "custom" && frequency === "weekly" ? weekdays.join(",") : ""} />
    <input type="hidden" name="recurrenceUntil" value={preset === "custom" ? until : ""} />
    {preset === "custom" && <div className="grid grid-cols-[minmax(176px,0.85fr)_minmax(0,1fr)] gap-3 max-sm:grid-cols-1">
      <div className="space-y-2"><Label htmlFor="recurrence-interval">Every</Label><div className="grid grid-cols-[40px_1fr_40px] gap-2"><Button type="button" variant="outline" size="icon" aria-label="Decrease repeat interval" disabled={interval <= 1} onClick={() => adjustInterval(-1)}><Minus /></Button><Input id="recurrence-interval" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" className="text-center tabular-nums" value={intervalInput} onChange={(event) => setIntervalInput(recurrenceIntervalDigits(event.target.value))} onBlur={() => setIntervalInput(String(interval))} /><Button type="button" variant="outline" size="icon" aria-label="Increase repeat interval" disabled={interval >= 99} onClick={() => adjustInterval(1)}><Plus /></Button></div></div>
      <div className="space-y-2"><Label>Unit</Label><Select value={frequency} onValueChange={(value) => setFrequency(value as RecurrenceFrequency)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="daily">Days</SelectItem><SelectItem value="weekly">Weeks</SelectItem><SelectItem value="monthly">Months</SelectItem><SelectItem value="yearly">Years</SelectItem></SelectContent></Select></div>
      {frequency === "weekly" && <div className="col-span-full space-y-2"><Label>On</Label><div className="grid grid-cols-7 gap-1">{weekdayOptions.map((day) => <Button key={day.value} type="button" size="sm" variant={weekdays.includes(day.value) ? "default" : "outline"} className="px-0" aria-pressed={weekdays.includes(day.value)} onClick={() => toggleWeekday(day.value)}>{day.label}</Button>)}</div></div>}
      <div className="col-span-full space-y-2"><Label htmlFor="recurrence-until">End date <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="recurrence-until" type="date" min={baseDate} aria-invalid={Boolean(error)} value={until} onChange={(event) => setUntil(event.target.value)} /></div>
    </div>}
    {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
  </div>;
}

function SelectField({ label, name, defaultValue, options, transformValue }: { label: string; name: string; defaultValue: string; options: { value: string; label: string; color?: string }[]; transformValue?: (value: string) => string }) {
  const [value, setValue] = useState(defaultValue);
  return <div className="space-y-2"><Label>{label}</Label><input type="hidden" name={name} value={transformValue ? transformValue(value) : value} /><Select value={value} onValueChange={setValue}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.color ? <span className="flex items-center gap-2"><span className="size-2.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ backgroundColor: option.color }} />{option.label}</span> : option.label}</SelectItem>)}</SelectContent></Select></div>;
}
