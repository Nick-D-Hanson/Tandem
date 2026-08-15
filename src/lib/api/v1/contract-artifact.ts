import { z } from "zod";

import {
  apiActivitySuccessSchema,
  apiAgendaSuccessSchema,
  apiCalendarSuccessSchema,
  apiCategoriesSuccessSchema,
  apiFailureSchema,
  apiMeSuccessSchema,
  apiTasksSuccessSchema,
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
    },
  } as const;
}
