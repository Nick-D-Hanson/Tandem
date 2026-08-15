import { z } from "zod";

const uuidSchema = z.uuid();
const isoTimestampSchema = z.iso.datetime({ offset: true });

export const apiErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
]);

export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string().min(1).max(200),
});

export const apiFailureSchema = z.object({
  ok: z.literal(false),
  error: apiErrorSchema,
});

export const apiMemberSchema = z.object({
  userId: z.string().min(1).max(200),
  displayName: z.string().min(1).max(120),
  avatarUrl: z.url().nullable(),
});

export const apiMeDataSchema = z.object({
  apiVersion: z.literal("v1"),
  generatedAt: isoTimestampSchema,
  user: z.object({
    id: z.string().min(1).max(200),
    email: z.email(),
    displayName: z.string().min(1).max(120),
    avatarUrl: z.url().nullable(),
  }),
  workspace: z.object({
    id: uuidSchema,
    name: z.string().min(1).max(120),
    timezone: z.string().min(1).max(100),
  }),
  members: z.array(apiMemberSchema).min(1).max(2),
});

export function apiSuccessSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({ ok: z.literal(true), data: dataSchema });
}

export const apiMeSuccessSchema = apiSuccessSchema(apiMeDataSchema);
export const apiMeResponseSchema = z.union([apiMeSuccessSchema, apiFailureSchema]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiFailure = z.infer<typeof apiFailureSchema>;
export type ApiMeData = z.infer<typeof apiMeDataSchema>;
export type ApiMeResponse = z.infer<typeof apiMeResponseSchema>;
