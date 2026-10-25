import type { AuthenticatedUser } from "@/lib/authorization";
import type { ApiMeData } from "./contracts";

type MembershipContext = {
  user: AuthenticatedUser;
  membership: { workspaceId: string; displayName: string; avatarUrl: string | null };
};

type MeWorkspaceRow = {
  id: string;
  name: string;
  timezone: string;
};

type MeMemberRow = {
  workspaceId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
};

export function buildMeData(
  context: MembershipContext,
  workspace: MeWorkspaceRow | undefined,
  members: MeMemberRow[],
  generatedAt = new Date(),
): ApiMeData {
  if (!workspace || workspace.id !== context.membership.workspaceId) throw new Error("NOT_FOUND");
  if (members.length < 1 || members.length > 2) throw new Error("NOT_FOUND");
  if (members.some((member) => member.workspaceId !== context.membership.workspaceId)) throw new Error("NOT_FOUND");

  return {
    apiVersion: "v1",
    generatedAt: generatedAt.toISOString(),
    user: {
      id: context.user.id,
      email: context.user.email,
      displayName: context.membership.displayName,
      avatarUrl: context.membership.avatarUrl,
    },
    workspace: {
      id: workspace.id,
      name: workspace.name,
      timezone: workspace.timezone,
    },
    members: members.map((member) => ({
      userId: member.userId,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl,
    })),
  };
}
