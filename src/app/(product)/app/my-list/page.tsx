import { redirect } from "next/navigation";

import { TaskWorkspace } from "@/components/tasks/task-workspace";
import { getAppData } from "@/lib/data/app-data";
import { getActivityPage } from "@/lib/data/activity-data";
import { workspaceDateKey } from "@/lib/dates/timezone";

export const dynamic = "force-dynamic";

export default async function MyListPage({ searchParams }: { searchParams: Promise<{ activity?: string; view?: string; week?: string }> }) {
  const query = await searchParams;
  let data;
  try {
    const [appData, activityData] = await Promise.all([getAppData(), getActivityPage()]);
    data = { appData, activityData };
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") redirect("/sign-in?redirectTo=/app/my-list");
    if (error instanceof Error && error.message === "WORKSPACE_REQUIRED") redirect("/onboarding");
    throw error;
  }
  const today = workspaceDateKey(data.appData.workspace.timezone);
  const requestedWeek = /^\d{4}-\d{2}-\d{2}$/.test(query.week ?? "") ? query.week! : today;
  return <TaskWorkspace data={data.appData} activityData={data.activityData} today={today} initialWeek={requestedWeek} initialView={query.view === "matrix" ? "matrix" : "week"} initialActivityOpen={query.activity === "open"} />;
}
