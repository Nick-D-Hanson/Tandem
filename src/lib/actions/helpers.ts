import type { z } from "zod";

import type { ActionResult } from "@/lib/types";

export function validationFailure(error: z.ZodError): ActionResult<never> {
  return {
    ok: false,
    error: "Check the highlighted fields and try again.",
    fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
  };
}

export function actionFailure(error: unknown): ActionResult<never> {
  if (error instanceof Error) {
    const friendly: Record<string, string> = {
      AUTH_REQUIRED: "Please sign in to continue.",
      WORKSPACE_REQUIRED: "Create a workspace first.",
      WORKSPACE_FULL: "This workspace already has two members.",
      ALREADY_HAS_WORKSPACE: "You already belong to a workspace.",
      INVITE_INVALID: "This invite is invalid, expired, or already used.",
      NOT_FOUND: "That item is no longer available.",
    };
    if (friendly[error.message]) return { ok: false, error: friendly[error.message] };
  }
  console.error("Unexpected Tandem action error", error instanceof Error ? error.message : error);
  return { ok: false, error: "Something went wrong. Please try again." };
}
