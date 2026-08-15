import { describe, expect, it } from "vitest";

import { isCompleteAgendaReorder, moveAgendaItem, normalizeAgendaOrder, type AgendaOrderItem } from "@/lib/agenda/ordering";
import { planAgendaRollover } from "@/lib/agenda/rollover";
import { buildAgendaDays, isAgendaEmpty } from "@/lib/agenda/view";
import type { AgendaItemView } from "@/lib/types";

const first: AgendaOrderItem = { id: "first", date: "2026-08-02", position: 0 };
const second: AgendaOrderItem = { id: "second", date: "2026-08-02", position: 1 };
const third: AgendaOrderItem = { id: "third", date: "2026-08-03", position: 0 };

describe("Agenda ordering", () => {
  it("rolls yesterday behind existing today rows while preserving IDs and relative order", () => {
    expect(planAgendaRollover([
      { id: "yesterday-second", date: "2026-08-01", position: 9 },
      { id: "today-second", date: "2026-08-02", position: 5 },
      { id: "yesterday-first", date: "2026-08-01", position: 2 },
      { id: "today-first", date: "2026-08-02", position: 1 },
    ], "2026-08-01", "2026-08-02")).toEqual([
      { id: "today-first", date: "2026-08-02", position: 0 },
      { id: "today-second", date: "2026-08-02", position: 1 },
      { id: "yesterday-first", date: "2026-08-02", position: 2 },
      { id: "yesterday-second", date: "2026-08-02", position: 3 },
    ]);
  });
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

  it("inserts at an explicit slot within another day", () => {
    const fourth: AgendaOrderItem = { id: "fourth", date: "2026-08-03", position: 1 };
    const result = moveAgendaItem([{ date: "2026-08-02", items: [first, second] }, { date: "2026-08-03", items: [third, fourth] }], "second", "2026-08-02", "2026-08-03", "slot:2026-08-03:1");
    expect(result[1].items.map((item) => item.id)).toEqual(["third", "second", "fourth"]);
  });

  it("accounts for the removed item when using a same-day slot", () => {
    const sameDayThird: AgendaOrderItem = { id: "same-day-third", date: "2026-08-02", position: 2 };
    const result = moveAgendaItem([{ date: "2026-08-02", items: [first, second, sameDayThird] }], "first", "2026-08-02", "2026-08-02", "slot:2026-08-02:3");
    expect(result[0].items.map((item) => item.id)).toEqual(["second", "same-day-third", "first"]);
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
    const withoutYesterday = buildAgendaDays({ yesterday: "2026-08-01", future: ["2026-08-02", "2026-08-03", "2026-08-04"], items: [] });
    const withYesterday = buildAgendaDays({ yesterday: "2026-08-01", future: ["2026-08-02", "2026-08-03", "2026-08-04"], items: [item("carry", "2026-08-01")] });
    expect(withoutYesterday.map((day) => day.date)).toEqual(["2026-08-02", "2026-08-03", "2026-08-04"]);
    expect(withYesterday.map((day) => day.date)).toEqual(["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04"]);
    expect(withYesterday[0].isYesterday).toBe(true);
  });

  it("always projects the three-day horizon without storing empty slots", () => {
    const days = buildAgendaDays({ yesterday: "2026-08-01", future: ["2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05"], items: [item("today", "2026-08-02")] });
    expect(days).toHaveLength(3);
    expect(days.map((day) => day.date)).toEqual(["2026-08-02", "2026-08-03", "2026-08-04"]);
    expect(days[0].items).toHaveLength(1);
  });

  it("detects when every visible My List day is empty", () => {
    const emptyDays = buildAgendaDays({ yesterday: "2026-08-01", future: ["2026-08-02", "2026-08-03", "2026-08-04"], items: [] });
    const populatedDays = buildAgendaDays({ yesterday: "2026-08-01", future: ["2026-08-02", "2026-08-03", "2026-08-04"], items: [item("today", "2026-08-02")] });
    expect(isAgendaEmpty(emptyDays)).toBe(true);
    expect(isAgendaEmpty(populatedDays)).toBe(false);
  });
});
