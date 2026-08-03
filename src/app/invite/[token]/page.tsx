import Link from "next/link";
import { redirect } from "next/navigation";

import { Brand } from "@/components/brand";
import { InviteCard } from "@/components/invite/invite-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { inspectInviteAction } from "@/lib/actions/workspace";
import { getMembershipForUser, requireUser } from "@/lib/authorization";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await inspectInviteAction(token);
  if (!invite.ok) return <InviteState title="Invite unavailable" description={invite.error} />;

  let user = null;
  try { user = await requireUser(); } catch { /* Render sign-in gate. */ }
  if (!user) {
    const target = `/invite/${token}`;
    return <InviteState title={`You’re invited to ${invite.data.workspaceName}`} description="Sign in or create an account to accept this private invite."><Button asChild><Link href={`/sign-in?redirectTo=${encodeURIComponent(target)}`}>Sign in to continue</Link></Button><Button asChild variant="outline"><Link href={`/sign-up?redirectTo=${encodeURIComponent(target)}`}>Create account</Link></Button></InviteState>;
  }
  if (await getMembershipForUser(user.id)) redirect("/app/my-list");
  return <main className="grid min-h-dvh place-items-center p-4"><div className="flex w-full flex-col items-center gap-7"><Brand /><InviteCard token={token} workspaceName={invite.data.workspaceName} defaultName={user.name} /></div></main>;
}

function InviteState({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return <main className="grid min-h-dvh place-items-center p-4"><Card className="w-full max-w-md"><CardHeader><Brand className="mb-4" /><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>{children && <CardContent className="flex flex-col gap-2">{children}</CardContent>}</Card></main>;
}
