"use client";

import { Check, Copy, Loader2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWorkspaceAction } from "@/lib/actions/workspace";
import { copyText } from "@/lib/clipboard";
import { DEFAULT_WORKSPACE_NAME } from "@/lib/constants";
import { safeBrowserTimezone } from "@/lib/dates/timezone";
import { absoluteInviteUrl } from "@/lib/invites";

export function OnboardingForm({ defaultDisplayName }: { defaultDisplayName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [inviteLink, setInviteLink] = useState("");
  const [error, setError] = useState("");

  function submit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await createWorkspaceAction({
        name: String(formData.get("name") || ""),
        timezone: String(formData.get("timezone") || ""),
        displayName: String(formData.get("displayName") || ""),
      });
      if (!result.ok) return setError(result.error);
      setInviteLink(absoluteInviteUrl(result.data.invitePath, window.location.origin));
      toast.success("Workspace created");
    });
  }

  async function copyInvite() {
    const copied = await copyText(inviteLink);
    if (copied) toast.success("Invite link copied");
    else toast.error("Clipboard access was blocked. Select and copy the link manually.");
  }

  if (inviteLink) {
    return (
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <div className="mb-2 grid size-11 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Check /></div>
          <CardTitle>Your shared space is ready</CardTitle>
          <CardDescription>Send this private, seven-day invite link to the one person joining you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2"><Input readOnly value={inviteLink} aria-label="Invite link" /><Button type="button" variant="outline" size="icon" onClick={copyInvite} aria-label="Copy invite link"><Copy /></Button></div>
          <p className="text-xs text-muted-foreground">Only the cryptographic hash is stored. Creating a new link revokes this one.</p>
        </CardContent>
        <CardFooter><Button className="w-full" onClick={() => router.push("/app/my-list")}>Open Tandem</Button></CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader>
        <div className="mb-2 grid size-11 place-items-center rounded-full bg-primary/10 text-primary"><Users /></div>
        <CardTitle>Create your shared workspace</CardTitle>
        <CardDescription>Name the space you’ll share and choose the timezone that controls both calendars.</CardDescription>
      </CardHeader>
      <form action={submit}>
        <CardContent className="space-y-5">
          <div className="space-y-2"><Label htmlFor="workspace-name">Workspace name</Label><Input id="workspace-name" name="name" defaultValue={DEFAULT_WORKSPACE_NAME} required maxLength={80} /></div>
          <div className="space-y-2"><Label htmlFor="display-name">Your display name</Label><Input id="display-name" name="displayName" defaultValue={defaultDisplayName} required maxLength={80} /></div>
          <div className="space-y-2"><Label htmlFor="timezone">Workspace timezone</Label><Input id="timezone" name="timezone" defaultValue={safeBrowserTimezone()} required /><p className="text-xs text-muted-foreground">Use an IANA timezone such as America/Chicago.</p></div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        </CardContent>
        <CardFooter className="mt-5"><Button className="w-full" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Create workspace</Button></CardFooter>
      </form>
    </Card>
  );
}
