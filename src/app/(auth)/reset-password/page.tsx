import { AuthView } from "@neondatabase/auth-ui";

import { AuthShell } from "@/components/auth/auth-shell";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return <AuthShell eyebrow="Choose a secure new password."><AuthView path="reset-password" redirectTo="/app/my-list" /></AuthShell>;
}
