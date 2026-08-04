"use client";

import { BellRing, Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getPushSubscriptionStateAction, subscribePushAction, unsubscribePushAction } from "@/lib/actions/push";

type PushStatus = "checking" | "unsupported" | "ios_install_required" | "unconfigured" | "denied" | "disabled" | "enabled";

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

async function readyServiceWorker() {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("SERVICE_WORKER_UNAVAILABLE")), 5000)),
  ]);
}

export function PushOptIn() {
  const [status, setStatus] = useState<PushStatus>("checking");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [pending, startTransition] = useTransition();
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  useEffect(() => {
    let active = true;
    async function inspect() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setStatus("unsupported");
      if (isIosDevice() && !isStandalone()) return setStatus("ios_install_required");
      if (!publicKey) return setStatus("unconfigured");
      if (Notification.permission === "denied") return setStatus("denied");
      const registration = await readyServiceWorker();
      const current = await registration.pushManager.getSubscription();
      if (!active) return;
      setSubscription(current);
      if (!current) return setStatus("disabled");
      const result = await getPushSubscriptionStateAction({ endpoint: current.endpoint });
      if (!active) return;
      setStatus(result.ok && result.data.enabled ? "enabled" : "disabled");
    }
    void inspect().catch(() => active && setStatus("unsupported"));
    return () => { active = false; };
  }, [publicKey]);

  function enable() {
    startTransition(async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "disabled");
        return;
      }
      try {
        const registration = await readyServiceWorker();
        const existing = await registration.pushManager.getSubscription();
        const current = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) });
        const result = await subscribePushAction(current.toJSON());
        if (!result.ok) {
          if (!existing) await current.unsubscribe();
          toast.error(result.error);
          return;
        }
        setSubscription(current);
        setStatus("enabled");
        toast.success("Daily activity summary enabled");
      } catch {
        toast.error("Unable to enable notifications on this device.");
      }
    });
  }

  function disable() {
    if (!subscription) return setStatus("disabled");
    startTransition(async () => {
      try {
        const result = await unsubscribePushAction({ endpoint: subscription.endpoint });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        await subscription.unsubscribe();
        setSubscription(null);
        setStatus("disabled");
        toast.success("Daily activity summary disabled");
      } catch {
        toast.error("Unable to disable notifications on this device.");
      }
    });
  }

  if (status === "checking") return <div className="flex items-center gap-2 rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Checking notification support…</div>;
  const explanation = status === "ios_install_required"
    ? "On iPhone and iPad, add Tandem to your Home Screen and open it there to enable Web Push."
    : status === "unsupported"
      ? "Daily Web Push is not supported by this browser. Activity Summary still works here."
      : status === "unconfigured"
        ? "Daily Web Push is not configured on this Tandem environment."
        : status === "denied"
          ? "Notifications are blocked. Re-enable them in your browser or device settings to use the daily summary."
          : "Receive one private, title-free activity digest at approximately 7:00 PM Central when another member made relevant updates.";

  return <section className="rounded-xl border bg-muted/20 p-3.5" aria-labelledby="daily-summary-title">
    <div className="flex items-start gap-3"><BellRing className="mt-0.5 size-4.5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><h3 id="daily-summary-title" className="text-sm font-semibold">Daily activity summary</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{explanation}</p></div></div>
    {status === "enabled" ? <Button type="button" variant="outline" size="sm" className="mt-3 w-full" disabled={pending} onClick={disable}>{pending && <Loader2 className="animate-spin" />}Disable on this device</Button> : ["disabled"].includes(status) ? <Button type="button" size="sm" className="mt-3 w-full" disabled={pending} onClick={enable}>{pending && <Loader2 className="animate-spin" />}Enable daily summary</Button> : null}
  </section>;
}
