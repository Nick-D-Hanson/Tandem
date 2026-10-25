import { z } from "zod";

import { apiMoveDateBodySchema } from "./contracts";
import { apiFailure, apiSuccess } from "./http";

export function createMoveDateHandler<T>(move: (id: string, targetDate: string) => Promise<T>) {
  return async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> },
  ) {
    try {
      const contentLength = Number(request.headers.get("content-length") ?? "0");
      if (contentLength > 4096) throw new Error("VALIDATION_ERROR");
      const { id } = await context.params;
      const body = await request.json().catch(() => { throw new Error("VALIDATION_ERROR"); });
      const parsed = z.object({ id: z.uuid(), body: apiMoveDateBodySchema }).strict().safeParse({ id, body });
      if (!parsed.success) throw new Error("VALIDATION_ERROR");
      return apiSuccess(await move(parsed.data.id, parsed.data.body.targetDate));
    } catch (error) {
      return apiFailure(error);
    }
  };
}
