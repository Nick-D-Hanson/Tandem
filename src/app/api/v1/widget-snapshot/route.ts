import { createRequestReadHandler } from "@/lib/api/v1/read-handler";
import { getNativeWidgetSnapshot } from "@/lib/api/v1/widget-snapshot-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = createRequestReadHandler(async () => getNativeWidgetSnapshot());
