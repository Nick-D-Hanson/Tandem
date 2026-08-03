import { redirect } from "next/navigation";

import { Brand } from "@/components/brand";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { getMembershipForUser, requireUser } from "@/lib/authorization";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  let user;
  try { user = await requireUser(); } catch { redirect("/sign-in?redirectTo=/onboarding"); }
  if (await getMembershipForUser(user.id)) redirect("/app/my-list");
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-4 sm:p-8">
      <section className="flex w-full flex-col items-center gap-7">
        <Brand />
        <OnboardingForm defaultDisplayName={user.name} />
      </section>
    </main>
  );
}
