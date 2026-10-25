import { apiFailure, apiSuccess } from "./http";

export function createRequestReadHandler<T>(load: (request: Request) => Promise<T>) {
  return async function GET(request: Request) {
    try {
      return apiSuccess(await load(request));
    } catch (error) {
      return apiFailure(error);
    }
  };
}
