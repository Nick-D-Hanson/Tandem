import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { activitySeenSchema } from "@/lib/activity/schema";

describe("Activity read-state actions", () => {
  const actions = readFileSync(new URL("../src/lib/actions/activity.ts", import.meta.url), "utf8");
  const loader = readFileSync(new URL("../src/lib/data/activity-data.ts", import.meta.url), "utf8");

  it("accepts only a workspace-authorized activity ID from the client", () => {
    const id = "7f8fcb8a-4adb-4c66-8e91-a91cf7ff5d68";
    expect(activitySeenSchema.safeParse({ id }).success).toBe(true);
    expect(activitySeenSchema.safeParse({ id: "invalid" }).success).toBe(false);
    expect(actions).toContain("eq(activityEvents.workspaceId, membership.workspaceId)");
    expect(actions).not.toContain("eq(activityEvents.occurredAt, occurredAt)");
  });

  it("does not refresh the app beneath the open mobile Activity sheet", () => {
    expect(actions).not.toContain("revalidatePath");
  });

  it("filters the feed through the viewer's private clear watermark", () => {
    expect(loader).toContain("activityReadStates.clearedThroughAt");
    expect(loader).toContain("activityReadStates.clearedThroughEventId");
    expect(loader).toContain("visibleCondition");
  });
});
