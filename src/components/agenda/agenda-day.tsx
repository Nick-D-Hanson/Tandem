"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { Fragment, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localDate } from "@/lib/dates/timezone";
import type { AgendaDayView, AgendaItemView } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AgendaDay({ day, today, canEdit, draggingItemId, onCreate, onUpdate, onDelete, onClear }: {
  day: AgendaDayView;
  today: string;
  canEdit: boolean;
  draggingItemId: string | null;
  onCreate: (date: string, content: string) => Promise<boolean>;
  onUpdate: (item: AgendaItemView, content: string) => Promise<void>;
  onDelete: (item: AgendaItemView) => void;
  onClear: (date: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day.date}`, disabled: !canEdit });
  const [extraSlots, setExtraSlots] = useState(0);
  const panelRef = useRef<HTMLElement | null>(null);
  const baseSlots = canEdit && !day.isYesterday ? Math.max(0, 7 - day.items.length) : 0;
  const slotCount = baseSlots + extraSlots;
  const date = localDate(day.date);
  const label = day.isYesterday ? "Yesterday" : day.date === today ? "Today" : format(date, "EEEE");

  function addSlot() {
    setExtraSlots((value) => value + 1);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const drafts = panelRef.current?.querySelectorAll<HTMLInputElement>("input[data-agenda-draft]");
      drafts?.[drafts.length - 1]?.focus();
    }));
  }

  return (
    <section ref={(node) => { panelRef.current = node; setNodeRef(node); }} className={cn("min-w-0 rounded-xl border bg-card shadow-sm transition-colors", day.isYesterday && "bg-muted/35", isOver && "border-primary ring-2 ring-primary/20")} data-agenda-day={day.date}>
      <header className="flex min-h-14 items-center justify-between gap-2 border-b px-3 py-2">
        <div><h3 className="font-semibold">{label}</h3><p className="text-xs text-muted-foreground">{format(date, "MMM d, yyyy")}</p></div>
        {canEdit && day.items.length > 0 && <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => onClear(day.date)}>Clear day</Button>}
      </header>
      <div className="grid gap-1.5 p-2.5">
        <SortableContext items={day.items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          {canEdit && <AgendaDropSlot date={day.date} index={0} active={Boolean(draggingItemId)} />}
          {day.items.map((item, index) => canEdit
            ? <Fragment key={`${item.id}:${item.content}`}><SortableAgendaItem item={item} onUpdate={onUpdate} onDelete={onDelete} /><AgendaDropSlot date={day.date} index={index + 1} active={Boolean(draggingItemId)} /></Fragment>
            : <div key={item.id} className="min-h-10 rounded-lg border bg-background px-3 py-2 text-sm leading-5">{item.content}</div>)}
        </SortableContext>
        {Array.from({ length: slotCount }, (_, index) => <AgendaDraftRow key={`${day.date}-draft-${index}`} date={day.date} onCreate={onCreate} />)}
        {!canEdit && day.items.length === 0 && <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">No items planned.</p>}
      </div>
      {canEdit && !day.isYesterday && <div className="border-t p-2.5"><Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={addSlot}><Plus />Add item</Button></div>}
    </section>
  );
}

function AgendaDropSlot({ date, index, active }: { date: string; index: number; active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${date}:${index}`, disabled: !active });
  return <div ref={setNodeRef} data-agenda-drop-slot={`${date}:${index}`} className={cn("relative z-10 flex h-0 items-center justify-center overflow-hidden opacity-0", active && "-my-1.5 h-3 overflow-visible opacity-100")}>
    <span className={cn("h-px w-full rounded-full bg-transparent transition-colors duration-100", isOver && "h-0.5 bg-primary")} />
    {isOver && <span className="pointer-events-none absolute right-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-sm">Drop here</span>}
  </div>;
}

function SortableAgendaItem({ item, onUpdate, onDelete }: { item: AgendaItemView; onUpdate: (item: AgendaItemView, content: string) => Promise<void>; onDelete: (item: AgendaItemView) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const [value, setValue] = useState(item.content);
  const saving = useRef(false);
  const cancelSave = useRef(false);

  async function save() {
    if (saving.current) return;
    const content = value.trim();
    if (!content) { setValue(item.content); return; }
    if (content === item.content) return;
    saving.current = true;
    await onUpdate(item, content);
    saving.current = false;
  }

  return <div ref={setNodeRef} style={{ transform: isDragging ? CSS.Transform.toString(transform) : undefined, transition: isDragging ? transition : undefined }} className={cn("flex min-w-0 items-center gap-1 rounded-lg border bg-background p-1", isDragging && "z-20 opacity-75 shadow-lg")}>
    <button type="button" className="grid size-8 shrink-0 touch-none place-items-center rounded-md text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Move ${item.content}`} {...attributes} {...listeners}><GripVertical className="size-4" /></button>
    <Input value={value} maxLength={300} aria-label={`My List item: ${item.content}`} className="h-8 min-w-0 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0" onChange={(event) => setValue(event.target.value)} onBlur={() => { if (cancelSave.current) { cancelSave.current = false; return; } void save(); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void save(); event.currentTarget.blur(); } if (event.key === "Escape") { cancelSave.current = true; setValue(item.content); event.currentTarget.blur(); } }} />
    <Button type="button" variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground hover:text-destructive" aria-label={`Delete ${item.content}`} onClick={() => onDelete(item)}><Trash2 /></Button>
  </div>;
}

function AgendaDraftRow({ date, onCreate }: { date: string; onCreate: (date: string, content: string) => Promise<boolean> }) {
  const [value, setValue] = useState("");
  const submitting = useRef(false);

  async function save(focusNext = false) {
    const content = value.trim();
    if (!content || submitting.current) return;
    submitting.current = true;
    const saved = await onCreate(date, content);
    submitting.current = false;
    if (!saved) return;
    setValue("");
    if (focusNext) requestAnimationFrame(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>(`[data-agenda-day="${date}"] input[data-agenda-draft]`);
      for (const input of inputs) {
        if (!input.value && input !== document.activeElement) { input.focus(); break; }
      }
    });
  }

  return <Input data-agenda-draft value={value} maxLength={300} aria-label={`New My List item for ${format(localDate(date), "MMMM d")}`} placeholder="Add something…" className="h-10 border-dashed bg-background/70" onChange={(event) => setValue(event.target.value)} onBlur={() => void save()} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void save(true); } if (event.key === "Escape" && !value.trim()) event.currentTarget.blur(); }} />;
}
