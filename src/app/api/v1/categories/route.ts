import { createRequestReadHandler } from "@/lib/api/v1/read-handler";
import { getNativeCategories } from "@/lib/api/v1/read-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = createRequestReadHandler(async () => getNativeCategories());
