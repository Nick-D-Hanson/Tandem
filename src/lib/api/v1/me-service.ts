import { asc, eq } from "drizzle-orm";

import { workspaceMembers, workspaces } from "../../../../db/schema";
import { requireWorkspace } from "@/lib/authorization";
import { db } from "@/lib/db/client";
import type { ApiMeData } from "./contracts";
import { buildMeData } from "./me-data";

export async function getNativeMe(): Promise<ApiMeData> {
  const context = await requireWorkspace();
  const workspaceId = context.membership.workspaceId;
  const [workspaceRows, memberRows] = await Promise.all([
    db.select({ id: workspaces.id, name: workspaces.name, timezone: workspaces.timezone })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1),
    db.select({
      workspaceId: workspaceMembers.workspaceId,
      userId: workspaceMembers.userId,
      displayName: workspaceMembers.displayName,
      avatarUrl: workspaceMembers.avatarUrl,
    })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId))
      .orderBy(asc(workspaceMembers.joinedAt))
      .limit(2),
  ]);

  return buildMeData(context, workspaceRows[0], memberRows);
}
