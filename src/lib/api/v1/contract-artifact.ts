import { z } from "zod";

import { apiFailureSchema, apiMeSuccessSchema } from "./contracts";

export function buildNativeApiContractArtifact() {
  return {
    contractVersion: 1,
    apiVersion: "v1",
    mediaType: "application/json",
    endpoints: {
      "/api/v1/me": {
        method: "GET",
        authentication: "Neon Auth session",
        cache: "private, no-store",
        responses: {
          "200": z.toJSONSchema(apiMeSuccessSchema),
          "401": z.toJSONSchema(apiFailureSchema),
          "404": z.toJSONSchema(apiFailureSchema),
          "500": z.toJSONSchema(apiFailureSchema),
        },
      },
    },
  } as const;
}
