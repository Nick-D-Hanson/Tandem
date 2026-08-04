import { redirect } from "next/navigation";

import { getServerSessionData } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getServerSessionData();
  redirect(session?.user ? "/app/my-list" : "/sign-in");
}
