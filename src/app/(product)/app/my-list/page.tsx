import { redirect } from "next/navigation";

import { AgendaApp } from "@/components/agenda/agenda-app";
import { getAgendaData } from "@/lib/data/agenda-data";
import { getAppData } from "@/lib/data/app-data";
import { getActivityPage } from "@/lib/data/activity-data";

export const dynamic = "force-dynamic";

export default async function MyListPage({ searchParams }: { searchParams: Promise<{ activity?: string }> }) {
  const query = await searchParams;
  let data;
  try {
    const [appData, agendaData, activityData] = await Promise.all([getAppData(), getAgendaData(), getActivityPage()]);
    data = { appData, agendaData, activityData };
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") redirect("/sign-in?redirectTo=/app/my-list");
    if (error instanceof Error && error.message === "WORKSPACE_REQUIRED") redirect("/onboarding");
    throw error;
  }
  return <AgendaApp appData={data.appData} agendaData={data.agendaData} activityData={data.activityData} initialActivityOpen={query.activity === "open"} />;
}
