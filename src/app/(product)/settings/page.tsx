import { redirect } from "next/navigation";

import { SettingsForm } from "@/components/settings/settings-form";
import { getAppData } from "@/lib/data/app-data";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let data;
  try { data = await getAppData(); } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") redirect("/sign-in?redirectTo=/settings");
    if (error instanceof Error && error.message === "WORKSPACE_REQUIRED") redirect("/onboarding");
    throw error;
  }
  return <SettingsForm data={data} />;
}
