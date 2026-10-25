import { describe, expect, it } from "vitest";

import { assertSameWorkspace, assertTwoMemberLimit } from "@/lib/authorization/guards";

describe("authorization invariants", () => {
  it("rejects a third workspace member", () => {
    expect(() => assertTwoMemberLimit(2)).toThrow("WORKSPACE_FULL");
    expect(() => assertTwoMemberLimit(1)).not.toThrow();
  });

  it("hides cross-workspace resources", () => {
    expect(() => assertSameWorkspace("workspace-b", "workspace-a")).toThrow("NOT_FOUND");
    expect(() => assertSameWorkspace("workspace-a", "workspace-a")).not.toThrow();
  });
});
