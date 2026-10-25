"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, Check, Circle, Clock3, GripVertical, MoreHorizontal, Pencil } from "lucide-react";
import { format } from "date-fns";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { localDate, utcToLocalParts } from "@/lib/dates/timezone";
import { quadrantDetails, type PlannerQuadrant } from "@/lib/tasks/planner";
import type { ListView, TaskView } from "@/lib/types";
import { cn } from "@/lib/utils";

const quadrantStyles: Record<PlannerQuadrant, string> = {
  1: "border-l-[#d85e55]",
  2: "border-l-[#6b85df]",
  3: "border-l-[#d5a242]",
  4: "border-l-[#a7a9b2]",
};

const quadrantPillStyles: Record<PlannerQuadrant, string> = {
  1: "bg-[#ffebe8] text-[#9e3f39]",
  2: "bg-[#ebf0ff] text-[#4d67af]",
  3: "bg-[#fff4d9] text-[#8a641d]",
  4: "bg-[#f1f1f3] text-[#696b73]",
};

export function PlannerTaskCard({ task, instanceId, context, timezone, lists, weekDays, showScheduledDate = false, onToggle, onEdit, onMoveSchedule, onSetQuadrant }: {
  task: TaskView;
  instanceId: string;
  context: "schedule" | "backlog" | "matrix";
  timezone: string;
  lists: ListView[];
  weekDays: string[];
  showScheduledDate?: boolean;
  onToggle: (task: TaskView, completed: boolean) => void;
  onEdit: (task: TaskView) => void;
  onMoveSchedule: (task: TaskView, date: string | null) => void;
  onSetQuadrant: (task: TaskView, quadrant: PlannerQuadrant | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: instanceId, data: { kind: "task", context, taskId: task.id, scheduledDate: task.scheduledDate, quadrant: task.quadrant } });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && "opacity-35")}>
      <PlannerTaskCardBody task={task} timezone={timezone} lists={lists} weekDays={weekDays} showScheduledDate={showScheduledDate} onToggle={onToggle} onEdit={onEdit} onMoveSchedule={onMoveSchedule} onSetQuadrant={onSetQuadrant} dragHandle={{ ...attributes, ...listeners }} />
    </div>
  );
}

export function PlannerTaskCardOverlay({ task, timezone, lists }: { task: TaskView; timezone: string; lists: ListView[] }) {
  return <div className="pointer-events-none w-[220px] rotate-1 shadow-xl" aria-hidden><PlannerTaskCardBody task={task} timezone={timezone} lists={lists} weekDays={[]} showScheduledDate={Boolean(task.scheduledDate)} onToggle={() => undefined} onEdit={() => undefined} onMoveSchedule={() => undefined} onSetQuadrant={() => undefined} /></div>;
}

function PlannerTaskCardBody({ task, timezone, lists, weekDays, showScheduledDate, onToggle, onEdit, onMoveSchedule, onSetQuadrant, dragHandle }: {
  task: TaskView;
  timezone: string;
  lists: ListView[];
  weekDays: string[];
  showScheduledDate: boolean;
  onToggle: (task: TaskView, completed: boolean) => void;
  onEdit: (task: TaskView) => void;
  onMoveSchedule: (task: TaskView, date: string | null) => void;
  onSetQuadrant: (task: TaskView, quadrant: PlannerQuadrant | null) => void;
  dragHandle?: Record<string, unknown>;
}) {
  const dueDate = task.dueAt ? utcToLocalParts(task.dueAt, timezone).date : null;
  const category = lists.find((list) => list.id === task.listId);
  return (
    <article className={cn("group grid grid-cols-[22px_minmax(0,1fr)_auto] items-start gap-2 rounded-[10px] border border-l-[3px] bg-white px-3 py-2.5 text-[#30374a] shadow-[0_1px_2px_rgba(23,35,59,.03)] transition hover:border-[#bfb4e9] hover:bg-[#fcfbff] hover:shadow-[0_2px_9px_rgba(92,82,146,.09)] min-[821px]:grid-cols-[20px_minmax(0,1fr)_auto] min-[821px]:gap-1.5 min-[821px]:px-2 min-[821px]:py-2", task.quadrant ? quadrantStyles[task.quadrant] : "border-l-[#d7dbe3]", task.completedAt && "bg-[#fafbfc] opacity-65")} data-testid={`planner-task-${task.id}`}>
      <Checkbox checked={Boolean(task.completedAt)} onCheckedChange={(checked) => onToggle(task, Boolean(checked))} aria-label={`${task.completedAt ? "Reopen" : "Complete"} ${task.title}`} className="mt-0.5 size-5 border-[#bec3cf] data-[state=checked]:border-[#6b5bc6] data-[state=checked]:bg-[#6b5bc6] min-[821px]:size-4" />
      <button type="button" onClick={() => onEdit(task)} className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7965da] focus-visible:ring-offset-2">
        <span className={cn("block break-words text-[13px] font-medium leading-[1.45] min-[821px]:text-[12px]", task.completedAt && "line-through text-[#8b909c]")}>{task.title}</span>
        {(task.quadrant || dueDate || (showScheduledDate && task.scheduledDate) || category) && <span className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
          {task.quadrant && <span className={cn("rounded-[5px] px-1.5 py-0.5 font-medium", quadrantPillStyles[task.quadrant])}>Q{task.quadrant} · {quadrantDetails[task.quadrant].action}</span>}
          {dueDate && <span className="inline-flex items-center gap-1 rounded-[5px] bg-[#f4f4f6] px-1.5 py-0.5 text-[#697080]"><Clock3 className="size-2.5" />Due {format(localDate(dueDate), "MMM d")}</span>}
          {showScheduledDate && task.scheduledDate && <span className="inline-flex items-center gap-1 rounded-[5px] bg-[#f4f4f6] px-1.5 py-0.5 text-[#697080]"><CalendarDays className="size-2.5" />{format(localDate(task.scheduledDate), "MMM d")}</span>}
          {category && <span className="inline-flex items-center gap-1 rounded-[5px] bg-[#f4f4f6] px-1.5 py-0.5 text-[#697080]"><span className="size-1.5 rounded-full" style={{ backgroundColor: category.color }} />{category.name}</span>}
        </span>}
      </button>
      <div className="flex items-center gap-0.5">
        {dragHandle && <button type="button" aria-label={`Drag ${task.title}`} className="touch-none rounded p-1.5 text-[#8b8f9b] opacity-100 hover:bg-[#f0edf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7965da] min-[821px]:p-0.5 min-[821px]:opacity-40 min-[821px]:hover:opacity-100 min-[821px]:focus-visible:opacity-100" {...dragHandle}><GripVertical className="size-4 min-[821px]:size-3.5" /></button>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon-sm" className="size-8 text-[#7f8290] opacity-100 group-hover:opacity-100 focus:opacity-100 min-[821px]:size-6 min-[821px]:opacity-40" aria-label={`Task actions for ${task.title}`}><MoreHorizontal className="size-4 min-[821px]:size-3.5" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="task-workspace-theme w-56 bg-white text-[#293044]">
            <DropdownMenuItem onClick={() => onEdit(task)}><Pencil />Edit</DropdownMenuItem>
            <DropdownMenuSub><DropdownMenuSubTrigger><CalendarDays />Plan for</DropdownMenuSubTrigger><DropdownMenuSubContent className="task-workspace-theme bg-white text-[#293044]">
              <DropdownMenuItem onClick={() => onMoveSchedule(task, null)}>{task.scheduledDate === null ? <Check /> : <Circle />}Backlog</DropdownMenuItem>
              {weekDays.map((date) => <DropdownMenuItem key={date} onClick={() => onMoveSchedule(task, date)}>{task.scheduledDate === date ? <Check /> : <Circle />}{format(localDate(date), "EEE, MMM d")}</DropdownMenuItem>)}
            </DropdownMenuSubContent></DropdownMenuSub>
            <DropdownMenuSub><DropdownMenuSubTrigger><Circle />Priority</DropdownMenuSubTrigger><DropdownMenuSubContent className="task-workspace-theme bg-white text-[#293044]">
              <DropdownMenuLabel>Eisenhower matrix</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onSetQuadrant(task, null)}>{task.quadrant === null ? <Check /> : <Circle />}Unclassified</DropdownMenuItem>
              {[1, 2, 3, 4].map((value) => { const quadrant = value as PlannerQuadrant; return <DropdownMenuItem key={quadrant} onClick={() => onSetQuadrant(task, quadrant)}>{task.quadrant === quadrant ? <Check /> : <Circle />}Q{quadrant} · {quadrantDetails[quadrant].action}</DropdownMenuItem>; })}
            </DropdownMenuSubContent></DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onToggle(task, !task.completedAt)}>{task.completedAt ? "Reopen task" : "Mark complete"}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}
