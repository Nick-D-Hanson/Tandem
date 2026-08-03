import { describe, expect, it } from "vitest";

import { assertSameWorkspace, assertTwoMemberLimit } from "@/lib/authorization/guards";
import { assertAgendaOwner, assertAgendaReadAccess, canReadAgenda } from "@/lib/agenda/policy";

describe("authorization invariants", () => {
  it("rejects a third workspace member", () => {
    expect(() => assertTwoMemberLimit(2)).toThrow("WORKSPACE_FULL");
    expect(() => assertTwoMemberLimit(1)).not.toThrow();
  });

  it("hides cross-workspace resources", () => {
    expect(() => assertSameWorkspace("workspace-b", "workspace-a")).toThrow("NOT_FOUND");
    expect(() => assertSameWorkspace("workspace-a", "workspace-a")).not.toThrow();
  });

  it("keeps an Agenda private by default", () => {
    expect(canReadAgenda({ viewerUserId: "member-b", ownerUserId: "member-a", sameWorkspace: true, isShared: false })).toBe(false);
    expect(canReadAgenda({ viewerUserId: "member-a", ownerUserId: "member-a", sameWorkspace: true, isShared: false })).toBe(true);
  });

  it("allows a workspace member to read an explicitly shared Agenda", () => {
    expect(canReadAgenda({ viewerUserId: "member-b", ownerUserId: "member-a", sameWorkspace: true, isShared: true })).toBe(true);
    expect(() => assertAgendaReadAccess({ viewerUserId: "member-b", ownerUserId: "member-a", sameWorkspace: true, isShared: false })).toThrow("NOT_FOUND");
  });

  it("denies shared Agenda access across workspaces and all non-owner mutations", () => {
    expect(canReadAgenda({ viewerUserId: "member-b", ownerUserId: "member-a", sameWorkspace: false, isShared: true })).toBe(false);
    expect(() => assertAgendaOwner("member-b", "member-a")).toThrow("NOT_FOUND");
    expect(() => assertAgendaOwner("member-a", "member-a")).not.toThrow();
  });
});
