import { createRequestReadHandler } from "@/lib/api/v1/read-handler";
import { parseCalendarWindow } from "@/lib/api/v1/read-params";
import { getNativeCalendar } from "@/lib/api/v1/read-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = createRequestReadHandler(async (request) => getNativeCalendar(parseCalendarWindow(request.url)));
