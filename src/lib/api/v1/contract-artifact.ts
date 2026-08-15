import { z } from "zod";

import {
  apiActivitySuccessSchema,
  apiAgendaRolloverSuccessSchema,
  apiAgendaSuccessSchema,
  apiCalendarSuccessSchema,
  apiCategoriesSuccessSchema,
  apiFailureSchema,
  apiEventMoveSuccessSchema,
  apiMeSuccessSchema,
  apiMoveDateBodySchema,
  apiNativePushDeviceSuccessSchema,
  apiNativePushDisableBodySchema,
  apiNativePushRegistrationBodySchema,
  apiTaskMoveSuccessSchema,
  apiTasksSuccessSchema,
  apiWidgetSnapshotSuccessSchema,
} from "./contracts";

function readEndpoint(successSchema: z.ZodType, query?: Record<string, string>) {
  return {
    method: "GET",
    authentication: "Neon Auth session",
    cache: "private, no-store",
    ...(query ? { query } : {}),
    responses: {
      "200": z.toJSONSchema(successSchema),
      "400": z.toJSONSchema(apiFailureSchema),
      "401": z.toJSONSchema(apiFailureSchema),
      "404": z.toJSONSchema(apiFailureSchema),
      "500": z.toJSONSchema(apiFailureSchema),
    },
  };
}

function mutationEndpoint(method: "POST" | "PATCH" | "DELETE", successSchema: z.ZodType, bodySchema?: z.ZodType) {
  return {
    method,
    authentication: "Neon Auth session",
    cache: "private, no-store",
    ...(bodySchema ? { requestBody: z.toJSONSchema(bodySchema) } : {}),
    responses: {
      "200": z.toJSONSchema(successSchema),
      "400": z.toJSONSchema(apiFailureSchema),
      "401": z.toJSONSchema(apiFailureSchema),
      "404": z.toJSONSchema(apiFailureSchema),
      "409": z.toJSONSchema(apiFailureSchema),
      "500": z.toJSONSchema(apiFailureSchema),
    },
  };
}

export function buildNativeApiContractArtifact() {
  return {
    contractVersion: 1,
    apiVersion: "v1",
    mediaType: "application/json",
    endpoints: {
      "/api/v1/me": readEndpoint(apiMeSuccessSchema),
      "/api/v1/categories": readEndpoint(apiCategoriesSuccessSchema),
      "/api/v1/tasks": readEndpoint(apiTasksSuccessSchema, {
        limit: "integer, 1-100, default 50",
        before: "optional ISO 8601 updated-at cursor",
      }),
      "/api/v1/calendar": readEndpoint(apiCalendarSuccessSchema, {
        start: "required YYYY-MM-DD",
        end: "required inclusive YYYY-MM-DD; maximum 93 calendar days",
      }),
      "/api/v1/my-list": readEndpoint(apiAgendaSuccessSchema),
      "/api/v1/activity": readEndpoint(apiActivitySuccessSchema, {
        cursorOccurredAt: "optional ISO 8601 cursor; required with cursorId",
        cursorId: "optional UUID cursor; required with cursorOccurredAt",
      }),
      "/api/v1/my-list/rollover": mutationEndpoint("POST", apiAgendaRolloverSuccessSchema),
      "/api/v1/tasks/:id/move-date": mutationEndpoint("PATCH", apiTaskMoveSuccessSchema, apiMoveDateBodySchema),
      "/api/v1/events/:id/move-date": mutationEndpoint("PATCH", apiEventMoveSuccessSchema, apiMoveDateBodySchema),
      "/api/v1/widget-snapshot": readEndpoint(apiWidgetSnapshotSuccessSchema),
      "/api/v1/push/devices": {
        authentication: "Neon Auth session",
        cache: "private, no-store",
        operations: {
          POST: mutationEndpoint("POST", apiNativePushDeviceSuccessSchema, apiNativePushRegistrationBodySchema),
          DELETE: mutationEndpoint("DELETE", apiNativePushDeviceSuccessSchema, apiNativePushDisableBodySchema),
        },
      },
    },
  } as const;
}
