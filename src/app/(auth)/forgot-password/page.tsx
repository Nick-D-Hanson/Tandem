import { AuthView } from "@neondatabase/auth-ui";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { getServerSessionData } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const session = await getServerSessionData();
  if (session?.user) redirect("/app/my-list");
  return <AuthShell eyebrow="We’ll help you get back to your shared plan."><AuthView path="forgot-password" /></AuthShell>;
}
