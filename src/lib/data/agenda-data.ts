import { and, asc, eq, gte, lte, or } from "drizzle-orm";

import { agendaItems, agendaPreferences, workspaceMembers, workspaces } from "../../../db/schema";
import { requireWorkspace } from "@/lib/authorization";
import { db } from "@/lib/db/client";
import { agendaDateWindow } from "@/lib/dates/timezone";
import { canReadAgenda } from "@/lib/agenda/policy";
import { buildAgendaDays } from "@/lib/agenda/view";
import type { AgendaData, AgendaItemView, AgendaOwnerView } from "@/lib/types";

export async function getAgendaData(): Promise<AgendaData> {
  const { user, membership } = await requireWorkspace();
  const workspaceId = membership.workspaceId;
  const [workspaceRows, memberRows, preferenceRows] = await Promise.all([
    db.select({ timezone: workspaces.timezone }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1),
    db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId)).orderBy(asc(workspaceMembers.joinedAt)),
    db.select().from(agendaPreferences).where(and(eq(agendaPreferences.workspaceId, workspaceId), or(eq(agendaPreferences.userId, user.id), eq(agendaPreferences.isShared, true)))),
  ]);
  const workspace = workspaceRows[0];
  if (!workspace) throw new Error("WORKSPACE_NOT_FOUND");

  const preferences = new Map(preferenceRows.map((preference) => [preference.userId, preference]));
  const visibleMembers = memberRows.filter((member) => canReadAgenda({ viewerUserId: user.id, ownerUserId: member.userId, sameWorkspace: true, isShared: preferences.get(member.userId)?.isShared ?? false }));
  const window = agendaDateWindow(workspace.timezone);
  const itemRows = (await Promise.all(visibleMembers.map((member) => {
    const visibleDays = preferences.get(member.userId)?.visibleDays ?? 3;
    return db.select().from(agendaItems).where(and(
      eq(agendaItems.workspaceId, workspaceId),
      eq(agendaItems.ownerUserId, member.userId),
      gte(agendaItems.agendaDate, window.yesterday),
      lte(agendaItems.agendaDate, window.future[visibleDays - 1]),
    )).orderBy(asc(agendaItems.agendaDate), asc(agendaItems.position), asc(agendaItems.createdAt));
  }))).flat();

  const agendas = visibleMembers.map((member): AgendaOwnerView => {
    const preference = preferences.get(member.userId);
    const visibleDays = (preference?.visibleDays ?? 3) as 1 | 2 | 3;
    const ownerItems = itemRows.filter((item) => item.ownerUserId === member.userId);
    const serializedItems = ownerItems.map(serializeAgendaItem);
    return {
      ownerUserId: member.userId,
      displayName: member.displayName,
      canEdit: member.userId === user.id,
      visibleDays,
      isShared: preference?.isShared ?? false,
      days: buildAgendaDays({ yesterday: window.yesterday, future: window.future, visibleDays, items: serializedItems }),
    };
  });

  return { currentUserId: user.id, workspaceTimezone: workspace.timezone, today: window.today, agendas };
}

function serializeAgendaItem(item: typeof agendaItems.$inferSelect): AgendaItemView {
  return {
    id: item.id,
    content: item.content,
    date: item.agendaDate,
    position: item.position,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}
