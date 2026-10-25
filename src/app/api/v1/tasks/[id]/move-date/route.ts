import { moveTaskDate } from "@/lib/api/v1/date-mutation-service";
import { createMoveDateHandler } from "@/lib/api/v1/date-move-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const PATCH = createMoveDateHandler(moveTaskDate);
