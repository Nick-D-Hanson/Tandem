import type { ApiErrorCode, ApiFailure } from "./contracts";

type ApiErrorDefinition = {
  status: number;
  code: ApiErrorCode;
  message: string;
};

const ERROR_DEFINITIONS: Record<string, ApiErrorDefinition> = {
  AUTH_REQUIRED: { status: 401, code: "UNAUTHORIZED", message: "Authentication is required." },
  WORKSPACE_REQUIRED: { status: 404, code: "NOT_FOUND", message: "Workspace not found." },
  NOT_FOUND: { status: 404, code: "NOT_FOUND", message: "Resource not found." },
  VALIDATION_ERROR: { status: 400, code: "VALIDATION_ERROR", message: "The request is invalid." },
  CONFLICT: { status: 409, code: "CONFLICT", message: "The request conflicts with the current state." },
};

const DEFAULT_ERROR: ApiErrorDefinition = {
  status: 500,
  code: "INTERNAL_ERROR",
  message: "The request could not be completed.",
};

export function apiSuccess<T>(data: T, init?: ResponseInit) {
  return Response.json({ ok: true as const, data }, {
    ...init,
    headers: apiHeaders(init?.headers),
  });
}

export function apiFailure(error: unknown) {
  const definition = error instanceof Error
    ? ERROR_DEFINITIONS[error.message] ?? DEFAULT_ERROR
    : DEFAULT_ERROR;
  const body: ApiFailure = {
    ok: false,
    error: { code: definition.code, message: definition.message },
  };
  return Response.json(body, { status: definition.status, headers: apiHeaders() });
}

function apiHeaders(headers?: HeadersInit) {
  const result = new Headers(headers);
  result.set("Cache-Control", "private, no-store");
  result.set("Content-Type", "application/json; charset=utf-8");
  result.set("X-Tandem-Api-Version", "v1");
  return result;
}
