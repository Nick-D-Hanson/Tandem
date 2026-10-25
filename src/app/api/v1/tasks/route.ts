import { createRequestReadHandler } from "@/lib/api/v1/read-handler";
import { parseTaskQuery } from "@/lib/api/v1/read-params";
import { getNativeTasks } from "@/lib/api/v1/read-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = createRequestReadHandler(async (request) => getNativeTasks(parseTaskQuery(request.url)));
