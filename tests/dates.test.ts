import { describe, expect, it } from "vitest";

import { agendaDateWindow, localDateTimeToUtc, monthCalendarRange, utcToLocalParts, weekCalendarRange, workspaceDateKey } from "@/lib/dates/timezone";

describe("workspace timezone utilities", () => {
  it("round-trips a local wall time through UTC", () => {
    const instant = localDateTimeToUtc({ date: "2026-08-02", time: "18:30" }, "America/Chicago");
    expect(instant.toISOString()).toBe("2026-08-02T23:30:00.000Z");
    expect(utcToLocalParts(instant, "America/Chicago")).toEqual({ date: "2026-08-02", time: "18:30" });
  });

  it("does not shift an all-day date across a DST boundary", () => {
    const instant = localDateTimeToUtc({ date: "2026-11-01" }, "America/Chicago");
    expect(utcToLocalParts(instant, "America/Chicago").date).toBe("2026-11-01");
  });

  it("uses the workspace date when members are in different local days", () => {
    const instant = new Date("2026-08-03T03:30:00.000Z");
    expect(workspaceDateKey("America/Chicago", instant)).toBe("2026-08-02");
    expect(workspaceDateKey("Europe/London", instant)).toBe("2026-08-03");
  });

  it("builds a stable Agenda window across the spring DST boundary", () => {
    expect(agendaDateWindow("America/Chicago", new Date("2026-03-08T17:00:00.000Z"))).toEqual({
      yesterday: "2026-03-07",
      today: "2026-03-08",
      future: ["2026-03-08", "2026-03-09", "2026-03-10"],
      editable: ["2026-03-07", "2026-03-08", "2026-03-09", "2026-03-10"],
    });
  });
});

describe("calendar ranges", () => {
  it("returns the full six-week month grid", () => {
    const range = monthCalendarRange(new Date("2026-08-15T12:00:00"));
    expect(range).toHaveLength(42);
    expect(range[0].getDay()).toBe(0);
    expect(range[41].getDay()).toBe(6);
  });

  it("returns Sunday through Saturday for a week", () => {
    const range = weekCalendarRange(new Date("2026-08-05T12:00:00"));
    expect(range).toHaveLength(7);
    expect(range[0].getDay()).toBe(0);
    expect(range[6].getDay()).toBe(6);
  });
});
