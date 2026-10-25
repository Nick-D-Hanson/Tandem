import { describe, expect, it, vi } from "vitest";

import { createMoveDateHandler } from "@/lib/api/v1/date-move-handler";
import { moveEventToLocalDate, moveTaskToLocalDate } from "@/lib/calendar/date-move";
import { localDateTimeToUtc, utcToLocalParts } from "@/lib/dates/timezone";

const timezone = "America/Chicago";

describe("calendar date-only moves", () => {
  it("moves an all-day Task to the workspace-local target date", () => {
    const dueAt = moveTaskToLocalDate({
      dueAt: localDateTimeToUtc({ date: "2026-03-07" }, timezone),
      dueIsAllDay: true,
      targetDate: "2026-03-08",
      timezone,
    });
    expect(utcToLocalParts(dueAt, timezone)).toEqual({ date: "2026-03-08", time: "00:00" });
  });

  it("preserves a Task's local time across the DST spring boundary", () => {
    const dueAt = moveTaskToLocalDate({
      dueAt: localDateTimeToUtc({ date: "2026-03-07", time: "09:30" }, timezone),
      dueIsAllDay: false,
      targetDate: "2026-03-08",
      timezone,
    });
    expect(utcToLocalParts(dueAt, timezone)).toEqual({ date: "2026-03-08", time: "09:30" });
  });

  it("preserves an all-day Event's inclusive multi-day span", () => {
    const result = moveEventToLocalDate({
      startAt: localDateTimeToUtc({ date: "2026-08-10" }, timezone),
      endAt: localDateTimeToUtc({ date: "2026-08-13" }, timezone),
      allDay: true,
      recurrence: null,
      targetDate: "2026-08-20",
      timezone,
    });
    expect(utcToLocalParts(result.startAt, timezone).date).toBe("2026-08-20");
    expect(utcToLocalParts(result.endAt, timezone).date).toBe("2026-08-23");
  });

  it("shifts both timed Event endpoints by the same calendar-day delta", () => {
    const result = moveEventToLocalDate({
      startAt: localDateTimeToUtc({ date: "2026-10-31", time: "18:00" }, timezone),
      endAt: localDateTimeToUtc({ date: "2026-11-02", time: "09:00" }, timezone),
      allDay: false,
      recurrence: null,
      targetDate: "2026-11-07",
      timezone,
    });
    expect(utcToLocalParts(result.startAt, timezone)).toEqual({ date: "2026-11-07", time: "18:00" });
    expect(utcToLocalParts(result.endAt, timezone)).toEqual({ date: "2026-11-09", time: "09:00" });
  });

  it("blocks recurring masters because occurrence exceptions are not modeled", () => {
    expect(() => moveEventToLocalDate({
      startAt: new Date("2026-08-10T15:00:00.000Z"),
      endAt: new Date("2026-08-10T16:00:00.000Z"),
      allDay: false,
      recurrence: "weekly",
      targetDate: "2026-08-20",
      timezone,
    })).toThrow("CONFLICT");
  });
});

describe("date move API handler", () => {
  it("validates the UUID/date body and forwards only those values", async () => {
    const move = vi.fn(async (id: string, targetDate: string) => ({ id, targetDate }));
    const response = await createMoveDateHandler(move)(
      new Request("https://tandem.test/api/v1/tasks/3344cc5f-bb0f-4c38-894d-a79122869f1d/move-date", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDate: "2026-08-20" }),
      }),
      { params: Promise.resolve({ id: "3344cc5f-bb0f-4c38-894d-a79122869f1d" }) },
    );
    expect(response.status).toBe(200);
    expect(move).toHaveBeenCalledWith("3344cc5f-bb0f-4c38-894d-a79122869f1d", "2026-08-20");
  });

  it("returns a safe 400 without calling the service for undeclared fields", async () => {
    const move = vi.fn();
    const response = await createMoveDateHandler(move)(
      new Request("https://tandem.test/api/v1/tasks/not-an-id/move-date", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDate: "2026-08-20", workspaceId: "foreign" }),
      }),
      { params: Promise.resolve({ id: "not-an-id" }) },
    );
    expect(response.status).toBe(400);
    expect(move).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "The request is invalid." },
    });
  });
});
