import { rolloverOwnAgendaToToday } from "@/lib/api/v1/agenda-mutation-service";
import { apiFailure, apiSuccess } from "@/lib/api/v1/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    return apiSuccess(await rolloverOwnAgendaToToday());
  } catch (error) {
    return apiFailure(error);
  }
}
