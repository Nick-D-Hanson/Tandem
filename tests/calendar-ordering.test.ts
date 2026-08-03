import { describe, expect, it } from "vitest";

import { compareCalendarItems, timedCalendarItemLayout } from "@/components/calendar/calendar-view";

describe("calendar item ordering", () => {
  it("keeps untimed items first and orders them by newest creation", () => {
    const items = [
      { time: "09:00", createdAt: "2026-08-01T09:00:00.000Z" },
      { time: null, createdAt: "2026-08-01T08:00:00.000Z" },
      { time: null, createdAt: "2026-08-02T08:00:00.000Z" },
    ].sort(compareCalendarItems);

    expect(items).toEqual([
      { time: null, createdAt: "2026-08-02T08:00:00.000Z" },
      { time: null, createdAt: "2026-08-01T08:00:00.000Z" },
      { time: "09:00", createdAt: "2026-08-01T09:00:00.000Z" },
    ]);
  });

  it("orders timed items chronologically", () => {
    const items = [
      { time: "18:30", createdAt: "2026-08-01T08:00:00.000Z" },
      { time: "08:15", createdAt: "2026-08-02T08:00:00.000Z" },
    ].sort(compareCalendarItems);

    expect(items.map((item) => item.time)).toEqual(["08:15", "18:30"]);
  });

  it("positions and sizes a timed event from its start and end interval", () => {
    expect(timedCalendarItemLayout("09:30", 90)).toMatchObject({
      top: "28px",
      height: "84px",
    });
  });
});
