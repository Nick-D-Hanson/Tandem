import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Push subscription action authorization", () => {
  const source = readFileSync(new URL("../src/lib/actions/push.ts", import.meta.url), "utf8");

  it("protects endpoint upserts against a concurrent cross-owner overwrite", () => {
    const subscribeAction = source.slice(source.indexOf("export async function subscribePushAction"), source.indexOf("export async function unsubscribePushAction"));
    expect(subscribeAction).toContain("setWhere: and(");
    expect(subscribeAction).toContain("eq(pushSubscriptions.workspaceId, membership.workspaceId)");
    expect(subscribeAction).toContain("eq(pushSubscriptions.userId, user.id)");
    expect(subscribeAction).toContain('if (!subscription) throw new Error("NOT_FOUND")');
  });

  it("scopes unsubscribe and inspection to endpoint, workspace, and user", () => {
    const scopedWorkspaceMatches = source.match(/eq\(pushSubscriptions\.workspaceId, membership\.workspaceId\)/g) ?? [];
    const scopedUserMatches = source.match(/eq\(pushSubscriptions\.userId, user\.id\)/g) ?? [];
    expect(scopedWorkspaceMatches.length).toBeGreaterThanOrEqual(3);
    expect(scopedUserMatches.length).toBeGreaterThanOrEqual(3);
  });
});
