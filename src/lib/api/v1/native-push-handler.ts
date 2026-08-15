import { apiNativePushDisableBodySchema, apiNativePushRegistrationBodySchema } from "./contracts";
import { apiFailure, apiSuccess } from "./http";

async function readBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 2048) throw new Error("VALIDATION_ERROR");
  return request.json().catch(() => { throw new Error("VALIDATION_ERROR"); });
}

export function createNativePushHandlers(dependencies: {
  register: (input: { deviceId: string; platform: "ios"; expoPushToken: string }) => Promise<unknown>;
  disable: (deviceId: string) => Promise<unknown>;
}) {
  return {
    POST: async (request: Request) => {
      try {
        const parsed = apiNativePushRegistrationBodySchema.safeParse(await readBody(request));
        if (!parsed.success) throw new Error("VALIDATION_ERROR");
        return apiSuccess(await dependencies.register(parsed.data));
      } catch (error) {
        return apiFailure(error);
      }
    },
    DELETE: async (request: Request) => {
      try {
        const parsed = apiNativePushDisableBodySchema.safeParse(await readBody(request));
        if (!parsed.success) throw new Error("VALIDATION_ERROR");
        return apiSuccess(await dependencies.disable(parsed.data.deviceId));
      } catch (error) {
        return apiFailure(error);
      }
    },
  };
}
