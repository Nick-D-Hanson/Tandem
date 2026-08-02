"use server";

import { createHash, randomBytes } from "node:crypto";
import { addDays } from "date-fns";
import { and, eq, gt, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { workspaceInvites, workspaceMembers, workspaces } from "../../../db/schema";
import { INVITE_TTL_DAYS, LIST_COLORS } from "@/lib/constants";
import { requireUser, requireWorkspace } from "@/lib/authorization";
import { db, neonSql } from "@/lib/db/client";
import type { ActionResult } from "@/lib/types";
import { inviteTokenSchema, workspaceSchema } from "@/lib/validation/schemas";
import { actionFailure, validationFailure } from "./helpers";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createWorkspaceAction(input: unknown): Promise<ActionResult<{ invitePath: string }>> {
  const parsed = workspaceSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const user = await requireUser();
    const existing = await db.select({ id: workspaceMembers.id }).from(workspaceMembers).where(eq(workspaceMembers.userId, user.id)).limit(1);
    if (existing.length) throw new Error("ALREADY_HAS_WORKSPACE");

    const createdRows = await neonSql`
      WITH new_workspace AS (
        INSERT INTO workspaces (name, timezone, created_by)
        VALUES (${parsed.data.name}, ${parsed.data.timezone}, ${user.id})
        RETURNING id
      ), new_member AS (
        INSERT INTO workspace_members (workspace_id, user_id, display_name, avatar_url)
        SELECT id, ${user.id}, ${parsed.data.displayName}, ${user.image}
        FROM new_workspace
      ), new_lists AS (
        INSERT INTO task_lists (workspace_id, name, color, position)
        SELECT id, list.name, list.color, list.position
        FROM new_workspace
        CROSS JOIN (VALUES
          ('Home', ${LIST_COLORS[1]}, 0),
          ('Work', ${LIST_COLORS[2]}, 1),
          ('Errands', ${LIST_COLORS[3]}, 2)
        ) AS list(name, color, position)
      )
      SELECT id AS workspace_id FROM new_workspace
    ` as { workspace_id: string }[];
    const [created] = createdRows;

    if (!created) throw new Error("WORKSPACE_CREATE_FAILED");
    const invitePath = await createInviteForWorkspace(created.workspace_id, user.id);
    revalidatePath("/app");
    return { ok: true, data: { invitePath } };
  } catch (error) {
    return actionFailure(error);
  }
}

async function createInviteForWorkspace(workspaceId: string, userId: string) {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);

  await db
    .update(workspaceInvites)
    .set({ revokedAt: new Date() })
    .where(and(eq(workspaceInvites.workspaceId, workspaceId), isNull(workspaceInvites.acceptedAt), isNull(workspaceInvites.revokedAt)));

  await db.insert(workspaceInvites).values({
    workspaceId,
    tokenHash,
    createdBy: userId,
    expiresAt: addDays(new Date(), INVITE_TTL_DAYS),
  });

  return `/invite/${rawToken}`;
}

export async function createInviteAction(): Promise<ActionResult<{ invitePath: string }>> {
  try {
    const { user, membership } = await requireWorkspace();
    const memberCount = await db.select({ id: workspaceMembers.id }).from(workspaceMembers).where(eq(workspaceMembers.workspaceId, membership.workspaceId));
    if (memberCount.length >= 2) throw new Error("WORKSPACE_FULL");
    const invitePath = await createInviteForWorkspace(membership.workspaceId, user.id);
    return { ok: true, data: { invitePath } };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function inspectInviteAction(token: string): Promise<ActionResult<{ workspaceName: string }>> {
  const parsed = inviteTokenSchema.safeParse({ token });
  if (!parsed.success) return { ok: false, error: "This invite link is invalid." };
  try {
    const [invite] = await db
      .select({ name: workspaces.name })
      .from(workspaceInvites)
      .innerJoin(workspaces, eq(workspaces.id, workspaceInvites.workspaceId))
      .where(and(
        eq(workspaceInvites.tokenHash, hashToken(token)),
        gt(workspaceInvites.expiresAt, new Date()),
        isNull(workspaceInvites.acceptedAt),
        isNull(workspaceInvites.revokedAt),
      ))
      .limit(1);
    if (!invite) throw new Error("INVITE_INVALID");
    return { ok: true, data: { workspaceName: invite.name } };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function acceptInviteAction(input: { token: string; displayName: string }): Promise<ActionResult<{ workspaceId: string }>> {
  const tokenResult = inviteTokenSchema.safeParse({ token: input.token });
  if (!tokenResult.success || !input.displayName.trim()) return { ok: false, error: "Enter your name to join." };

  try {
    const user = await requireUser();
    const joinedRows = await neonSql`
      WITH valid_invite AS MATERIALIZED (
        SELECT wi.id AS invite_id, wi.workspace_id
        FROM workspace_invites wi
        WHERE wi.token_hash = ${hashToken(input.token)}
          AND wi.expires_at > now()
          AND wi.accepted_at IS NULL
          AND wi.revoked_at IS NULL
      ), locked_workspace AS MATERIALIZED (
        SELECT w.id
        FROM workspaces w
        JOIN valid_invite vi ON vi.workspace_id = w.id
        FOR UPDATE
      ), inserted_member AS (
        INSERT INTO workspace_members (workspace_id, user_id, display_name, avatar_url)
        SELECT lw.id, ${user.id}, ${input.displayName.trim()}, ${user.image}
        FROM locked_workspace lw
        WHERE NOT EXISTS (SELECT 1 FROM workspace_members own WHERE own.user_id = ${user.id})
          AND (SELECT count(*) FROM workspace_members count_members WHERE count_members.workspace_id = lw.id) < 2
        RETURNING workspace_id
      ), accepted_invite AS (
        UPDATE workspace_invites wi
        SET accepted_by = ${user.id}, accepted_at = now()
        FROM valid_invite vi, inserted_member im
        WHERE wi.id = vi.invite_id AND im.workspace_id = vi.workspace_id
        RETURNING wi.workspace_id
      )
      SELECT workspace_id FROM accepted_invite
    ` as { workspace_id: string }[];
    const [joined] = joinedRows;
    if (!joined) throw new Error("INVITE_INVALID");
    revalidatePath("/app");
    return { ok: true, data: { workspaceId: joined.workspace_id } };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updateWorkspaceAction(input: { name: string; timezone: string }): Promise<ActionResult> {
  try {
    const { membership } = await requireWorkspace();
    const parsed = workspaceSchema.pick({ name: true, timezone: true }).safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    await db.update(workspaces).set({ ...parsed.data, updatedAt: new Date() }).where(eq(workspaces.id, membership.workspaceId));
    revalidatePath("/app");
    revalidatePath("/settings");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error);
  }
}
