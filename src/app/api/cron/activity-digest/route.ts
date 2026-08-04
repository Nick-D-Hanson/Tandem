import { NextResponse } from "next/server";

import { processActivityDigests } from "@/lib/push/digest";
import { centralDigestWindow } from "@/lib/push/digest-core";
import { validBearerAuthorization } from "@/lib/push/cron-auth";
import { createWebPushSender } from "@/lib/push/web-push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!validBearerAuthorization(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }
  const window = centralDigestWindow(new Date());
  if (!window.shouldRun) {
    return NextResponse.json({ status: "skipped_wrong_local_hour", localHour: window.localHour });
  }
  const sender = createWebPushSender();
  if (!sender) return NextResponse.json({ status: "skipped_push_unconfigured" });
  const summary = await processActivityDigests(window, sender);
  return NextResponse.json({ status: "processed", digestDate: window.digestDate, ...summary });
}
