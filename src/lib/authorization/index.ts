import { and, eq } from "drizzle-orm";
import { cache } from "react";

import { workspaceMembers } from "../../../db/schema";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db/client";

export { assertSameWorkspace, assertTwoMemberLimit } from "./guards";

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
};

export const requireUser = cache(async (): Promise<AuthenticatedUser> => {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) throw new Error("AUTH_REQUIRED");
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? session.user.email?.split("@")[0] ?? "Member",
    image: session.user.image ?? null,
  };
});

export const getMembershipForUser = cache(async (userId: string) => {
  const [membership] = await db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))
    .limit(1);
  return membership ?? null;
});

export async function requireWorkspace() {
  const user = await requireUser();
  const membership = await getMembershipForUser(user.id);
  if (!membership) throw new Error("WORKSPACE_REQUIRED");
  return { user, membership };
}

export async function requireWorkspaceMember(workspaceId: string) {
  const user = await requireUser();
  const [membership] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.userId, user.id), eq(workspaceMembers.workspaceId, workspaceId)))
    .limit(1);
  if (!membership) throw new Error("NOT_FOUND");
  return { user, membership };
}
