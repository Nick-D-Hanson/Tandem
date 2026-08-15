import { apiAgendaDataSchema } from "@/lib/api/v1/contracts";
import { createRequestReadHandler } from "@/lib/api/v1/read-handler";
import { getAgendaData } from "@/lib/data/agenda-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = createRequestReadHandler(async () => apiAgendaDataSchema.parse(await getAgendaData()));
