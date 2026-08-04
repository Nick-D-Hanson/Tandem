export type SanitizedPushError = {
  code: string;
  message: string;
  expired: boolean;
};

type WebPushError = Error & { statusCode?: number };

export function sanitizePushError(error: unknown): SanitizedPushError {
  const statusCode = typeof error === "object" && error !== null && "statusCode" in error
    ? Number((error as WebPushError).statusCode)
    : null;
  if (statusCode === 404 || statusCode === 410) {
    return { code: `push_${statusCode}`, message: "Push endpoint expired", expired: true };
  }
  if (statusCode && Number.isInteger(statusCode)) {
    return { code: `push_${statusCode}`, message: "Push provider rejected delivery", expired: false };
  }
  return { code: "push_delivery_error", message: "Push delivery failed", expired: false };
}
