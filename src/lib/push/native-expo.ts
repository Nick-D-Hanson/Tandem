import "server-only";

export type NativePushTarget = { expoPushToken: string };

export type NativePushSender = {
  send(target: NativePushTarget, payload: { title: string; body: string; url: string }): Promise<void>;
};

export function createExpoPushSender(fetcher: typeof fetch = fetch): NativePushSender {
  return {
    async send(target, payload) {
      const response = await fetcher("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          to: target.expoPushToken,
          title: payload.title,
          body: payload.body,
          data: { url: payload.url },
          sound: "default",
        }),
      });
      if (!response.ok) throw new Error("NATIVE_PUSH_DELIVERY_FAILED");
      const result = await response.json() as { data?: { status?: string; details?: { error?: string } } };
      if (result.data?.status !== "ok") throw new Error(result.data?.details?.error === "DeviceNotRegistered" ? "PUSH_SUBSCRIPTION_EXPIRED" : "NATIVE_PUSH_DELIVERY_FAILED");
    },
  };
}
