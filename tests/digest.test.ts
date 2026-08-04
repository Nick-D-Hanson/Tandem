import { describe, expect, it } from "vitest";

import { assignedToRecipientCount, buildDigestPayload, canAttemptDelivery, centralDigestWindow, finalDigestStatus, relevantDigestActivities, type DigestActivity } from "@/lib/push/digest-core";
import { validBearerAuthorization } from "@/lib/push/cron-auth";
import { sanitizePushError } from "@/lib/push/errors";

const recipientId = "recipient-user";

function details(assigneeUserId: string | null, changes: Array<{ before: string | null; after: string | null }> = []) {
  return {
    version: 1 as const,
    changes: changes.map((change) => ({
      field: "assignee" as const,
      before: { value: change.before, label: null },
      after: { value: change.after, label: null },
    })),
    snapshot: {
      dateLabel: null,
      categoryId: null,
      categoryName: null,
      priority: "high" as const,
      assigneeUserId,
      assigneeName: null,
      isRecurringSeries: false,
    },
  };
}

describe("Central daily digest window", () => {
  it("uses the summer UTC invocation and skips its companion invocation", () => {
    const active = centralDigestWindow(new Date("2026-08-05T00:15:00.000Z"));
    const skipped = centralDigestWindow(new Date("2026-08-05T01:15:00.000Z"));
    expect(active).toMatchObject({ shouldRun: true, localHour: 19, digestDate: "2026-08-04" });
    expect(skipped).toMatchObject({ shouldRun: false, localHour: 20 });
  });

  it("uses the winter UTC invocation and skips its companion invocation", () => {
    const skipped = centralDigestWindow(new Date("2026-12-05T00:15:00.000Z"));
    const active = centralDigestWindow(new Date("2026-12-05T01:15:00.000Z"));
    expect(skipped).toMatchObject({ shouldRun: false, localHour: 18 });
    expect(active).toMatchObject({ shouldRun: true, localHour: 19, digestDate: "2026-12-04" });
  });

  it("creates a 23-hour spring-forward window", () => {
    const window = centralDigestWindow(new Date("2026-03-09T00:15:00.000Z"));
    expect(window.end.getTime() - window.start.getTime()).toBe(23 * 60 * 60 * 1000);
    expect(window.start.toISOString()).toBe("2026-03-08T01:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-03-09T00:00:00.000Z");
  });

  it("creates a 25-hour fall-back window", () => {
    const window = centralDigestWindow(new Date("2026-11-02T01:15:00.000Z"));
    expect(window.end.getTime() - window.start.getTime()).toBe(25 * 60 * 60 * 1000);
    expect(window.start.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-11-02T01:00:00.000Z");
  });
});

describe("digest summary privacy and assignment counts", () => {
  const events: DigestActivity[] = [
    { actorUserId: "alex-user", actorDisplayName: "Alex", entityType: "task", actionType: "created", details: details(recipientId) },
    { actorUserId: "alex-user", actorDisplayName: "Alex", entityType: "task", actionType: "updated", details: details(recipientId, [{ before: "someone-else", after: recipientId }]) },
    { actorUserId: "alex-user", actorDisplayName: "Alex", entityType: "event", actionType: "updated", details: details(null) },
  ];

  it("counts created assignments and reassignment changes to the recipient", () => {
    expect(assignedToRecipientCount(events, recipientId)).toBe(2);
  });

  it("builds a title-free generic lock-screen payload", () => {
    const payload = JSON.parse(buildDigestPayload(events, recipientId));
    expect(payload.title).toBe("Tandem activity summary");
    expect(payload.body).toContain("3 workspace updates from Alex");
    expect(payload.body).toContain("2 tasks assigned to you");
    expect(payload.url).toBe("/app/my-list?activity=open");
    expect(JSON.stringify(payload)).not.toContain("Dinner");
  });
});

describe("digest selection and idempotency decisions", () => {
  const other: DigestActivity = { actorUserId: "other-user", actorDisplayName: "Alex", entityType: "task", actionType: "created", details: details(null) };
  const own: DigestActivity = { ...other, actorUserId: recipientId, actorDisplayName: "Me" };

  it("excludes recipient-authored activity and produces no work for an own-only day", () => {
    expect(relevantDigestActivities([own, other], recipientId)).toEqual([other]);
    expect(relevantDigestActivities([own], recipientId)).toEqual([]);
  });

  it("retries pending/failed deliveries but never successful or in-flight ones", () => {
    expect(canAttemptDelivery("pending")).toBe(true);
    expect(canAttemptDelivery("failed")).toBe(true);
    expect(canAttemptDelivery("sent")).toBe(false);
    expect(canAttemptDelivery("processing")).toBe(false);
    expect(canAttemptDelivery("expired")).toBe(false);
  });

  it("derives sent, partial, and failed digest outcomes", () => {
    expect(finalDigestStatus(["sent", "sent"])).toBe("sent");
    expect(finalDigestStatus(["sent", "failed"])).toBe("partial");
    expect(finalDigestStatus(["expired", "failed"])).toBe("failed");
    expect(finalDigestStatus([])).toBe("failed");
  });
});

describe("push error sanitization", () => {
  it.each([404, 410])("marks %s endpoints expired", (statusCode) => {
    expect(sanitizePushError(Object.assign(new Error("secret endpoint"), { statusCode }))).toEqual({
      code: `push_${statusCode}`,
      message: "Push endpoint expired",
      expired: true,
    });
  });

  it("does not persist provider error text", () => {
    const result = sanitizePushError(new Error("https://push.example/token auth-secret"));
    expect(result).toEqual({ code: "push_delivery_error", message: "Push delivery failed", expired: false });
  });
});

describe("cron authorization", () => {
  it("accepts only an exact bearer secret", () => {
    expect(validBearerAuthorization("Bearer cron-secret", "cron-secret")).toBe(true);
    expect(validBearerAuthorization("Bearer wrong-secret", "cron-secret")).toBe(false);
    expect(validBearerAuthorization(null, "cron-secret")).toBe(false);
    expect(validBearerAuthorization("Bearer cron-secret", undefined)).toBe(false);
  });
});
