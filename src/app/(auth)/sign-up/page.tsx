import { AuthView } from "@neondatabase/auth-ui";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { getServerSessionData } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ redirectTo?: string }> }) {
  const [session, query] = await Promise.all([getServerSessionData(), searchParams]);
  if (session?.user) redirect(query.redirectTo?.startsWith("/") ? query.redirectTo : "/onboarding");
  const redirectTo = query.redirectTo?.startsWith("/") ? query.redirectTo : "/onboarding";
  return <AuthShell eyebrow="Create your shared workspace in a minute."><AuthView path="sign-up" redirectTo={redirectTo} /></AuthShell>;
}
