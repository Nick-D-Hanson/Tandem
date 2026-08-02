import { describe, expect, it } from "vitest";

import { isCompleteAgendaReorder, moveAgendaItem, normalizeAgendaOrder, type AgendaOrderItem } from "@/lib/agenda/ordering";
import { buildAgendaDays } from "@/lib/agenda/view";
import type { AgendaItemView } from "@/lib/types";

const first: AgendaOrderItem = { id: "first", date: "2026-08-02", position: 0 };
const second: AgendaOrderItem = { id: "second", date: "2026-08-02", position: 1 };
const third: AgendaOrderItem = { id: "third", date: "2026-08-03", position: 0 };

describe("Agenda ordering", () => {
  it("normalizes positions within each day", () => {
    expect(normalizeAgendaOrder([{ date: "2026-08-02", itemIds: ["second", "first"] }])).toEqual([
      { id: "second", date: "2026-08-02", position: 0 },
      { id: "first", date: "2026-08-02", position: 1 },
    ]);
  });

  it("moves within the same day", () => {
    const result = moveAgendaItem([{ date: "2026-08-02", items: [first, second] }], "first", "2026-08-02", "2026-08-02", "second");
    expect(result[0].items).toEqual([{ ...second, position: 0 }, { ...first, position: 1 }]);
  });

  it("moves across days and reindexes both sides", () => {
    const result = moveAgendaItem([{ date: "2026-08-02", items: [first, second] }, { date: "2026-08-03", items: [third] }], "second", "2026-08-02", "2026-08-03", "third");
    expect(result[0].items).toEqual([first]);
    expect(result[1].items).toEqual([{ ...second, date: "2026-08-03", position: 0 }, { ...third, position: 1 }]);
  });

  it("rejects stale, missing, foreign, and duplicate reorder sets", () => {
    const current = [first, second, third];
    expect(isCompleteAgendaReorder(current, [{ date: "2026-08-02", itemIds: ["first"] }])).toBe(false);
    expect(isCompleteAgendaReorder(current, [{ date: "2026-08-02", itemIds: ["first", "foreign"] }])).toBe(false);
    expect(isCompleteAgendaReorder(current, [{ date: "2026-08-02", itemIds: ["first", "first"] }])).toBe(false);
    expect(isCompleteAgendaReorder(current, [{ date: "2026-08-02", itemIds: ["second", "first"] }])).toBe(true);
  });
});

describe("Agenda day projection", () => {
  const item = (id: string, date: string): AgendaItemView => ({ id, date, content: id, position: 0, createdAt: "2026-08-02T12:00:00.000Z", updatedAt: "2026-08-02T12:00:00.000Z" });

  it("only includes yesterday when it contains an item", () => {
    const withoutYesterday = buildAgendaDays({ yesterday: "2026-08-01", future: ["2026-08-02", "2026-08-03", "2026-08-04"], visibleDays: 3, items: [] });
    const withYesterday = buildAgendaDays({ yesterday: "2026-08-01", future: ["2026-08-02", "2026-08-03", "2026-08-04"], visibleDays: 3, items: [item("carry", "2026-08-01")] });
    expect(withoutYesterday.map((day) => day.date)).toEqual(["2026-08-02", "2026-08-03", "2026-08-04"]);
    expect(withYesterday.map((day) => day.date)).toEqual(["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04"]);
    expect(withYesterday[0].isYesterday).toBe(true);
  });

  it("honors the one-day horizon without storing empty slots", () => {
    const days = buildAgendaDays({ yesterday: "2026-08-01", future: ["2026-08-02", "2026-08-03", "2026-08-04"], visibleDays: 1, items: [item("today", "2026-08-02")] });
    expect(days).toHaveLength(1);
    expect(days[0].items).toHaveLength(1);
  });
});
