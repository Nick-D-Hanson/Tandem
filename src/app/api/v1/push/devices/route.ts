import { createNativePushHandlers } from "@/lib/api/v1/native-push-handler";
import { disableNativePushDevice, registerNativePushDevice } from "@/lib/api/v1/native-push-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const { POST, DELETE } = createNativePushHandlers({ register: registerNativePushDevice, disable: disableNativePushDevice });
