import "server-only";

import webPush from "web-push";

export type PushTarget = {
  endpoint: string;
  p256dhKey: string;
  authKey: string;
};

export type PushSender = {
  send(target: PushTarget, payload: string): Promise<void>;
};

export function createWebPushSender(): PushSender | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;

  webPush.setVapidDetails(subject, publicKey, privateKey);
  return {
    async send(target, payload) {
      await webPush.sendNotification({
        endpoint: target.endpoint,
        keys: { p256dh: target.p256dhKey, auth: target.authKey },
      }, payload, { TTL: 60 * 60 * 6 });
    },
  };
}
