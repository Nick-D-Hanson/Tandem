import { describe, expect, it, vi } from "vitest";

import { createNativePushHandlers } from "@/lib/api/v1/native-push-handler";
import type { NativePushSender } from "@/lib/push/native-expo";
import { sendDigestThroughTransport } from "@/lib/push/transport";
import type { PushSender } from "@/lib/push/web-push";

const deviceId = "3344cc5f-bb0f-4c38-894d-a79122869f1d";
const token = "ExponentPushToken[abcdefghijklmnopqrstuv]";

describe("native push registration API", () => {
  it("validates a bounded iOS registration without accepting identity fields", async () => {
    const register = vi.fn(async () => ({ id: deviceId, deviceId, platform: "ios", enabled: true }));
    const handlers = createNativePushHandlers({ register, disable: vi.fn() });
    const response = await handlers.POST(new Request("https://tandem.test/api/v1/push/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, platform: "ios", expoPushToken: token }),
    }));
    expect(response.status).toBe(200);
    expect(register).toHaveBeenCalledWith({ deviceId, platform: "ios", expoPushToken: token });
    expect(JSON.stringify(await response.json())).not.toContain(token);
  });

  it("rejects client-supplied workspace authority", async () => {
    const register = vi.fn();
    const handlers = createNativePushHandlers({ register, disable: vi.fn() });
    const response = await handlers.POST(new Request("https://tandem.test/api/v1/push/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, platform: "ios", expoPushToken: token, workspaceId: "foreign" }),
    }));
    expect(response.status).toBe(400);
    expect(register).not.toHaveBeenCalled();
  });
});

describe("digest transport routing", () => {
  it("routes web and native targets to separate adapters", async () => {
    const web: PushSender = { send: vi.fn(async () => undefined) };
    const native: NativePushSender = { send: vi.fn(async () => undefined) };
    const payload = { title: "Tandem activity summary", body: "One workspace update.", url: "tandem://activity" };
    await sendDigestThroughTransport({ transport: "web", endpoint: "https://push.example", p256dhKey: "p", authKey: "a" }, payload, { web, native });
    await sendDigestThroughTransport({ transport: "native", expoPushToken: token }, payload, { web, native });
    expect(web.send).toHaveBeenCalledTimes(1);
    expect(native.send).toHaveBeenCalledWith({ expoPushToken: token }, payload);
  });
});
