import type { AgendaDayView, AgendaItemView } from "@/lib/types";

export function buildAgendaDays(input: { yesterday: string; future: string[]; items: AgendaItemView[] }): AgendaDayView[] {
  const yesterdayItems = input.items.filter((item) => item.date === input.yesterday);
  return [
    ...(yesterdayItems.length ? [{ date: input.yesterday, items: yesterdayItems, isYesterday: true }] : []),
    ...input.future.slice(0, 3).map((date) => ({ date, items: input.items.filter((item) => item.date === date), isYesterday: false })),
  ];
}

export function isAgendaEmpty(days: AgendaDayView[]) {
  return days.every((day) => day.items.length === 0);
}
