import { redirect } from "next/navigation";

import { TandemApp } from "@/components/app-shell/tandem-app";
import { getAppData } from "@/lib/data/app-data";
import { localDate } from "@/lib/dates/timezone";

export const dynamic = "force-dynamic";

export default async function AppPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  const query = await searchParams;
  let data;
  try { data = await getAppData(); } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") redirect("/sign-in?redirectTo=/app");
    if (error instanceof Error && error.message === "WORKSPACE_REQUIRED") redirect("/onboarding");
    throw error;
  }
  const view = ["today", "month", "week", "quarter", "events", "agenda"].includes(query.view ?? "") ? query.view as "today" | "month" | "week" | "quarter" | "events" | "agenda" : "month";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(query.date ?? "") ? query.date : undefined;
  if (date) localDate(date!); // Validate parsing before passing to the client.
  return <TandemApp data={data} initialView={view} initialDate={date} />;
}
