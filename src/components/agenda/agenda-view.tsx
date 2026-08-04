"use client";

import { closestCenter, DndContext, KeyboardSensor, pointerWithin, PointerSensor, TouchSensor, useSensor, useSensors, type CollisionDetection, type DragEndEvent } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Eye, EyeOff, Loader2, Plus, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { AgendaDay } from "@/components/agenda/agenda-day";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { clearAgendaDay, createAgendaItem, deleteAgendaItem, reorderAgendaItems, updateAgendaItem, updateAgendaVisibility } from "@/lib/actions/agenda";
import { moveAgendaItem } from "@/lib/agenda/ordering";
import { isAgendaEmpty } from "@/lib/agenda/view";
import type { AgendaData, AgendaItemView, AgendaOwnerView } from "@/lib/types";

export function AgendaView({ data }: { data: AgendaData }) {
  const [agendaState, setAgendaState] = useState(() => ({ source: data.agendas, current: data.agendas }));
  const [selectedOwnerId, setSelectedOwnerId] = useState(data.currentUserId);
  const [clearDate, setClearDate] = useState<string | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (agendaState.source !== data.agendas) setAgendaState({ source: data.agendas, current: data.agendas });
  const agendas = agendaState.current;
  const selected = agendas.find((agenda) => agenda.ownerUserId === selectedOwnerId) ?? agendas[0];
  const ownAgenda = agendas.find((agenda) => agenda.ownerUserId === data.currentUserId);
  const selectedIsEmpty = selected ? isAgendaEmpty(selected.days) : false;

  function replaceAgenda(ownerUserId: string, update: (agenda: AgendaOwnerView) => AgendaOwnerView) {
    setAgendaState((state) => ({ ...state, current: state.current.map((agenda) => agenda.ownerUserId === ownerUserId ? update(agenda) : agenda) }));
  }

  function changeVisibility(value: string) {
    if (!ownAgenda || !["private", "shared"].includes(value)) return;
    const isShared = value === "shared";
    if (ownAgenda.isShared === isShared) return;
    replaceAgenda(data.currentUserId, (agenda) => ({ ...agenda, isShared }));
    startTransition(async () => {
      const result = await updateAgendaVisibility({ visibility: value });
      if (!result.ok) {
        replaceAgenda(data.currentUserId, (agenda) => ({ ...agenda, isShared: !isShared }));
        toast.error(result.error);
        return;
      }
      toast.success(isShared ? "My List shared with your workspace" : "My List is private");
    });
  }

  async function createItem(date: string, content: string) {
    const result = await createAgendaItem({ date, content });
    if (!result.ok) { toast.error(result.error); return false; }
    const now = new Date().toISOString();
    replaceAgenda(data.currentUserId, (agenda) => ({ ...agenda, days: agenda.days.map((day) => day.date === date ? { ...day, items: [...day.items, { id: result.data.id, content, date, position: day.items.length, createdAt: now, updatedAt: now }] } : day) }));
    return true;
  }

  async function updateItem(item: AgendaItemView, content: string) {
    const before = item.content;
    replaceItem(item.id, (current) => ({ ...current, content }));
    const result = await updateAgendaItem({ id: item.id, content });
    if (!result.ok) { replaceItem(item.id, (current) => ({ ...current, content: before })); toast.error(result.error); }
  }

  function replaceItem(id: string, update: (item: AgendaItemView) => AgendaItemView) {
    replaceAgenda(data.currentUserId, (agenda) => ({ ...agenda, days: agenda.days.map((day) => ({ ...day, items: day.items.map((item) => item.id === id ? update(item) : item) })) }));
  }

  function removeItem(item: AgendaItemView) {
    const snapshot = ownAgenda;
    replaceAgenda(data.currentUserId, (agenda) => ({ ...agenda, days: agenda.days.map((day) => ({ ...day, items: day.items.filter((candidate) => candidate.id !== item.id) })) }));
    startTransition(async () => {
      const result = await deleteAgendaItem(item.id);
      if (!result.ok) { if (snapshot) replaceAgenda(data.currentUserId, () => snapshot); toast.error(result.error); }
      else toast.success("My List item deleted");
    });
  }

  function clearDay() {
    if (!clearDate) return;
    const date = clearDate;
    const snapshot = ownAgenda;
    setClearDate(null);
    replaceAgenda(data.currentUserId, (agenda) => ({ ...agenda, days: agenda.days.map((day) => day.date === date ? { ...day, items: [] } : day) }));
    startTransition(async () => {
      const result = await clearAgendaDay({ date });
      if (!result.ok) { if (snapshot) replaceAgenda(data.currentUserId, () => snapshot); toast.error(result.error); }
      else toast.success("Day cleared");
    });
  }

  function dragEnd(event: DragEndEvent) {
    setDraggingItemId(null);
    if (!selected?.canEdit || !event.over || event.active.id === event.over.id) return;
    const current = agendas.find((agenda) => agenda.ownerUserId === data.currentUserId);
    if (!current) return;
    const sourceDay = current.days.find((day) => day.items.some((item) => item.id === event.active.id));
    const overId = String(event.over.id);
    const slotDate = /^slot:(\d{4}-\d{2}-\d{2}):\d+$/.exec(overId)?.[1];
    const targetDay = slotDate
      ? current.days.find((day) => day.date === slotDate)
      : overId.startsWith("day:")
        ? current.days.find((day) => day.date === overId.slice(4))
        : current.days.find((day) => day.items.some((item) => item.id === event.over?.id));
    if (!sourceDay || !targetDay) return;

    const nextDays = moveAgendaItem(current.days, String(event.active.id), sourceDay.date, targetDay.date, overId);
    const affectedDates = sourceDay.date === targetDay.date ? [sourceDay.date] : [sourceDay.date, targetDay.date];
    const payload = affectedDates.map((date) => ({ date, itemIds: nextDays.find((day) => day.date === date)?.items.map((item) => item.id) ?? [] }));
    const snapshot = current;
    replaceAgenda(data.currentUserId, (agenda) => ({ ...agenda, days: nextDays }));
    startTransition(async () => {
      const result = await reorderAgendaItems({ days: payload });
      if (!result.ok) { replaceAgenda(data.currentUserId, () => snapshot); toast.error(result.error); }
    });
  }

  if (!selected || !ownAgenda) return <div className="grid flex-1 place-items-center text-sm text-muted-foreground">My List is unavailable.</div>;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 lg:pb-0" role="tablist" aria-label="Workspace lists">
          {agendas.map((agenda) => <Button key={agenda.ownerUserId} role="tab" aria-selected={agenda.ownerUserId === selected.ownerUserId} variant={agenda.ownerUserId === selected.ownerUserId ? "secondary" : "ghost"} size="sm" className="shrink-0" onClick={() => setSelectedOwnerId(agenda.ownerUserId)}>{agenda.ownerUserId === data.currentUserId ? "My List" : `${agenda.displayName}'s List`}</Button>)}
        </div>
        {selected.canEdit ? <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup type="single" value={ownAgenda.isShared ? "shared" : "private"} variant="outline" size="sm" spacing={0} aria-label="My List visibility" onValueChange={changeVisibility}>
            <ToggleGroupItem value="private" aria-label="Private"><EyeOff />Private</ToggleGroupItem>
            <ToggleGroupItem value="shared" aria-label="Visible to workspace"><Users />Visible to workspace</ToggleGroupItem>
          </ToggleGroup>
          {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Saving" />}
          <span className="w-full text-xs text-muted-foreground lg:w-auto">A visible My List is read-only to other workspace members.</span>
        </div> : <Badge variant="secondary" className="w-fit"><Eye className="size-3" />Shared read-only</Badge>}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3 md:p-4">
        {!selected.canEdit && <div className="mb-3 rounded-lg border bg-muted/35 px-3 py-2 text-sm text-muted-foreground">{selected.displayName} shared this list with your workspace. Only they can change it.</div>}
        {selected.canEdit && selectedIsEmpty && <div className="mx-auto mb-3 flex w-full max-w-4xl items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/25 px-4 py-5 text-center text-sm text-muted-foreground"><Plus className="size-4 shrink-0" /><p>Nothing Added Yet, Click Plus to Add a Task to Your List</p></div>}
        <DndContext sensors={sensors} collisionDetection={agendaCollisionDetection} onDragStart={(event) => setDraggingItemId(String(event.active.id))} onDragCancel={() => setDraggingItemId(null)} onDragEnd={dragEnd}>
          <div className="mx-auto grid w-full max-w-4xl min-w-0 grid-cols-1 gap-3">
            {selected.days.map((day) => <AgendaDay key={day.date} day={day} today={data.today} canEdit={selected.canEdit} draggingItemId={draggingItemId} onCreate={createItem} onUpdate={updateItem} onDelete={removeItem} onClear={setClearDate} />)}
          </div>
        </DndContext>
      </div>
      <AlertDialog open={Boolean(clearDate)} onOpenChange={(open) => !open && setClearDate(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Clear this day?</AlertDialogTitle><AlertDialogDescription>Every item on this day will be permanently deleted. This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={clearDay}>Clear day</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}

const agendaCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const insertionTargets = pointerCollisions.filter(({ id }) => String(id).startsWith("slot:"));
  if (insertionTargets.length) return insertionTargets;
  return pointerCollisions.length ? pointerCollisions : closestCenter(args);
};
