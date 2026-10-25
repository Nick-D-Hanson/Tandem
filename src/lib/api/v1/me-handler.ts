import type { ApiMeData } from "./contracts";
import { apiFailure, apiSuccess } from "./http";

export function createMeHandler(loadMe: () => Promise<ApiMeData>) {
  return async function GET() {
    try {
      return apiSuccess(await loadMe());
    } catch (error) {
      return apiFailure(error);
    }
  };
}
