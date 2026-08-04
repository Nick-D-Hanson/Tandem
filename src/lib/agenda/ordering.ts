export type AgendaOrderItem = { id: string; date: string; position: number };
export type AgendaOrderDay<T extends AgendaOrderItem = AgendaOrderItem> = { date: string; items: T[] };

export function normalizeAgendaOrder(days: Array<{ date: string; itemIds: string[] }>) {
  return days.flatMap((day) => day.itemIds.map((id, position) => ({ id, date: day.date, position })));
}

export function isCompleteAgendaReorder(current: AgendaOrderItem[], days: Array<{ date: string; itemIds: string[] }>) {
  const affectedDates = new Set(days.map((day) => day.date));
  const expected = current.filter((item) => affectedDates.has(item.date)).map((item) => item.id).sort();
  const supplied = days.flatMap((day) => day.itemIds).sort();
  return expected.length === supplied.length && expected.every((id, index) => id === supplied[index]) && new Set(supplied).size === supplied.length;
}

export function moveAgendaItem<T extends AgendaOrderItem, D extends AgendaOrderDay<T>>(days: D[], itemId: string, sourceDate: string, targetDate: string, overId: string): D[] {
  const source = days.find((day) => day.date === sourceDate);
  const target = days.find((day) => day.date === targetDate);
  const item = source?.items.find((candidate) => candidate.id === itemId);
  if (!source || !target || !item) return days;

  if (sourceDate === targetDate) {
    const items = [...source.items];
    const from = items.findIndex((candidate) => candidate.id === itemId);
    const over = items.findIndex((candidate) => candidate.id === overId);
    const [moved] = items.splice(from, 1);
    const slot = dropSlotIndex(overId, targetDate);
    const targetIndex = slot === null ? (over < 0 ? items.length : over) : Math.min(items.length, Math.max(0, slot - (from < slot ? 1 : 0)));
    items.splice(targetIndex, 0, moved);
    return days.map((day) => day.date === sourceDate ? { ...day, items: normalizeItems(items, sourceDate) } as D : day);
  }

  const targetItems = [...target.items];
  const slot = dropSlotIndex(overId, targetDate);
  const targetIndex = targetItems.findIndex((candidate) => candidate.id === overId);
  const insertionIndex = slot === null ? (targetIndex < 0 ? targetItems.length : targetIndex) : Math.min(targetItems.length, Math.max(0, slot));
  targetItems.splice(insertionIndex, 0, { ...item, date: targetDate });
  return days.map((day) => {
    if (day.date === sourceDate) return { ...day, items: normalizeItems(day.items.filter((candidate) => candidate.id !== itemId), sourceDate) } as D;
    if (day.date === targetDate) return { ...day, items: normalizeItems(targetItems, targetDate) } as D;
    return day;
  });
}

function dropSlotIndex(overId: string, targetDate: string) {
  const match = /^slot:(\d{4}-\d{2}-\d{2}):(\d+)$/.exec(overId);
  return match?.[1] === targetDate ? Number(match[2]) : null;
}

function normalizeItems<T extends AgendaOrderItem>(items: T[], date: string) {
  return items.map((item, position) => ({ ...item, date, position }));
}
