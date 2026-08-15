import { createMeHandler } from "@/lib/api/v1/me-handler";
import { getNativeMe } from "@/lib/api/v1/me-service";

export const dynamic = "force-dynamic";
export const GET = createMeHandler(getNativeMe);
