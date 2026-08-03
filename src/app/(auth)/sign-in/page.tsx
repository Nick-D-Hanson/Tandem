import { AuthView } from "@neondatabase/auth-ui";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ redirectTo?: string }> }) {
  const [{ data: session }, query] = await Promise.all([auth.getSession(), searchParams]);
  if (session?.user) redirect(query.redirectTo?.startsWith("/") ? query.redirectTo : "/app/my-list");
  const redirectTo = query.redirectTo?.startsWith("/") ? query.redirectTo : "/app/my-list";
  return <AuthShell eyebrow="Two people. One calm place to plan."><AuthView path="sign-in" redirectTo={redirectTo} /></AuthShell>;
}
