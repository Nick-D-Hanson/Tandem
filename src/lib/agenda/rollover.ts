export type AgendaRolloverItem = {
  id: string;
  date: string;
  position: number;
};

export type AgendaRolloverUpdate = {
  id: string;
  date: string;
  position: number;
};

export function planAgendaRollover(
  items: AgendaRolloverItem[],
  yesterday: string,
  today: string,
): AgendaRolloverUpdate[] {
  const todayItems = items
    .filter((item) => item.date === today)
    .sort(compareAgendaPosition);
  const yesterdayItems = items
    .filter((item) => item.date === yesterday)
    .sort(compareAgendaPosition);

  return [...todayItems, ...yesterdayItems].map((item, position) => ({
    id: item.id,
    date: today,
    position,
  }));
}

function compareAgendaPosition(left: AgendaRolloverItem, right: AgendaRolloverItem) {
  return left.position - right.position || left.id.localeCompare(right.id);
}
