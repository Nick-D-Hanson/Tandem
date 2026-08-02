export function assertTwoMemberLimit(memberCount: number) {
  if (memberCount >= 2) throw new Error("WORKSPACE_FULL");
}

export function assertSameWorkspace(actualWorkspaceId: string | undefined, expectedWorkspaceId: string) {
  if (!actualWorkspaceId || actualWorkspaceId !== expectedWorkspaceId) throw new Error("NOT_FOUND");
}
