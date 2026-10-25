import { eq } from "drizzle-orm";

import { workspaces } from "../../../../db/schema";
import { requireWorkspace } from "@/lib/authorization";
import { db } from "@/lib/db/client";
import { buildWidgetSnapshot, widgetSnapshotWindow } from "./widget-snapshot";
import { getNativeCalendar, getNativeCategories } from "./read-service";

export async function getNativeWidgetSnapshot() {
  const { membership } = await requireWorkspace();
  const [workspace] = await db.select({ timezone: workspaces.timezone })
    .from(workspaces)
    .where(eq(workspaces.id, membership.workspaceId))
    .limit(1);
  if (!workspace) throw new Error("NOT_FOUND");
  const now = new Date();
  const window = widgetSnapshotWindow(workspace.timezone, now);
  const [calendar, categories] = await Promise.all([
    getNativeCalendar(window),
    getNativeCategories(),
  ]);
  return buildWidgetSnapshot({ calendar, categories, now });
}
