import { redirect } from "next/navigation";

import { TandemApp } from "@/components/app-shell/tandem-app";
import { getAppData } from "@/lib/data/app-data";
import { getActivityPage } from "@/lib/data/activity-data";
import { localDate } from "@/lib/dates/timezone";

export const dynamic = "force-dynamic";

export default async function AppPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; activity?: string }> }) {
  const query = await searchParams;
  if (query.view === "agenda") redirect("/app/my-list");
  let data;
  try {
    const [appData, activityData] = await Promise.all([getAppData(), getActivityPage()]);
    data = { appData, activityData };
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") redirect("/sign-in?redirectTo=/app");
    if (error instanceof Error && error.message === "WORKSPACE_REQUIRED") redirect("/onboarding");
    throw error;
  }
  const view = ["today", "month", "week", "quarter", "events"].includes(query.view ?? "") ? query.view as "today" | "month" | "week" | "quarter" | "events" : "month";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(query.date ?? "") ? query.date : undefined;
  if (date) localDate(date!); // Validate parsing before passing to the client.
  return <TandemApp data={data.appData} activityData={data.activityData} initialView={view} initialDate={date} initialActivityOpen={query.activity === "open"} />;
}
