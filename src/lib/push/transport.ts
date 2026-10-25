import type { NativePushSender } from "./native-expo";
import type { PushSender } from "./web-push";

export type DigestTransportTarget =
  | { transport: "web"; endpoint: string; p256dhKey: string; authKey: string }
  | { transport: "native"; expoPushToken: string };

export async function sendDigestThroughTransport(
  target: DigestTransportTarget,
  payload: { title: string; body: string; url: string },
  senders: { web: PushSender; native: NativePushSender },
) {
  if (target.transport === "native") return senders.native.send({ expoPushToken: target.expoPushToken }, payload);
  return senders.web.send(target, JSON.stringify(payload));
}
