import { describe, expect, it } from "vitest";

import { nextRecurrenceDate, parseRecurrence, recurrenceMatchesDate, serializeRecurrence } from "@/lib/recurrence";

describe("recurrence rules", () => {
  it("supports annual events", () => {
    const rule = { frequency: "yearly" as const, interval: 1 };
    expect(recurrenceMatchesDate("2026-08-02", "2027-08-02", rule)).toBe(true);
    expect(recurrenceMatchesDate("2026-08-02", "2027-08-03", rule)).toBe(false);
  });

  it("supports custom biweekly weekday schedules", () => {
    const rule = { frequency: "weekly" as const, interval: 2, weekdays: [1, 3] };
    expect(recurrenceMatchesDate("2026-08-03", "2026-08-05", rule)).toBe(true);
    expect(recurrenceMatchesDate("2026-08-03", "2026-08-12", rule)).toBe(false);
    expect(recurrenceMatchesDate("2026-08-03", "2026-08-17", rule)).toBe(true);
  });

  it("honors an optional end date", () => {
    const rule = { frequency: "daily" as const, interval: 1, until: "2026-08-04" };
    expect(recurrenceMatchesDate("2026-08-02", "2026-08-04", rule)).toBe(true);
    expect(recurrenceMatchesDate("2026-08-02", "2026-08-05", rule)).toBe(false);
    expect(nextRecurrenceDate("2026-08-04", rule)).toBeNull();
  });

  it("keeps legacy presets compatible and round-trips custom rules", () => {
    expect(parseRecurrence("monthly")).toEqual({ frequency: "monthly", interval: 1 });
    const custom = { frequency: "yearly" as const, interval: 2, until: "2030-08-02" };
    expect(parseRecurrence(serializeRecurrence(custom))).toEqual(custom);
  });
});
