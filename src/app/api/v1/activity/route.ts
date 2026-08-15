import { apiActivityDataSchema } from "@/lib/api/v1/contracts";
import { createRequestReadHandler } from "@/lib/api/v1/read-handler";
import { parseActivityCursor } from "@/lib/api/v1/read-params";
import { getActivityPage } from "@/lib/data/activity-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = createRequestReadHandler(async (request) => (
  apiActivityDataSchema.parse(await getActivityPage(parseActivityCursor(request.url)))
));
