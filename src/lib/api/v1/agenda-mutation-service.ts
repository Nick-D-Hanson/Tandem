import { and, asc, eq, inArray } from "drizzle-orm";

import { agendaItems, workspaces } from "../../../../db/schema";
import { planAgendaRollover } from "@/lib/agenda/rollover";
import { requireWorkspace } from "@/lib/authorization";
import { withDatabaseTransaction } from "@/lib/db/transaction";
import { agendaDateWindow } from "@/lib/dates/timezone";

export async function rolloverOwnAgendaToToday() {
  const { user, membership } = await requireWorkspace();

  return withDatabaseTransaction(async (transaction) => {
    const [workspace] = await transaction.select({ timezone: workspaces.timezone })
      .from(workspaces)
      .where(eq(workspaces.id, membership.workspaceId))
      .limit(1);
    if (!workspace) throw new Error("NOT_FOUND");

    const window = agendaDateWindow(workspace.timezone);
    const rows = await transaction.select({
      id: agendaItems.id,
      date: agendaItems.agendaDate,
      position: agendaItems.position,
    }).from(agendaItems).where(and(
      eq(agendaItems.workspaceId, membership.workspaceId),
      eq(agendaItems.ownerUserId, user.id),
      inArray(agendaItems.agendaDate, [window.yesterday, window.today]),
    )).orderBy(asc(agendaItems.agendaDate), asc(agendaItems.position), asc(agendaItems.id)).for("update");

    if (!rows.some((row) => row.date === window.yesterday)) throw new Error("NOT_FOUND");
    const updates = planAgendaRollover(rows, window.yesterday, window.today);
    const updatedAt = new Date();
    for (const update of updates) {
      const [updated] = await transaction.update(agendaItems).set({
        agendaDate: update.date,
        position: update.position,
        updatedAt,
      }).where(and(
        eq(agendaItems.id, update.id),
        eq(agendaItems.workspaceId, membership.workspaceId),
        eq(agendaItems.ownerUserId, user.id),
      )).returning({ id: agendaItems.id });
      if (!updated) throw new Error("NOT_FOUND");
    }

    return {
      movedCount: rows.filter((row) => row.date === window.yesterday).length,
      today: window.today,
    };
  });
}
