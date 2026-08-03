"use client";

import { Loader2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInviteAction } from "@/lib/actions/workspace";

export function InviteCard({ token, workspaceName, defaultName }: { token: string; workspaceName: string; defaultName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await acceptInviteAction({ token, displayName: String(formData.get("displayName") || "") });
      if (!result.ok) return setError(result.error);
      toast.success(`Joined ${workspaceName}`);
      router.replace("/app/my-list");
      router.refresh();
    });
  }

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader><div className="mb-2 grid size-11 place-items-center rounded-full bg-primary/10 text-primary"><Users /></div><CardTitle>Join {workspaceName}</CardTitle><CardDescription>You’ll be the second and final member. Everything in this workspace is shared.</CardDescription></CardHeader>
      <form action={submit}>
        <CardContent className="space-y-3"><Label htmlFor="invite-name">Your display name</Label><Input id="invite-name" name="displayName" defaultValue={defaultName} required />{error && <p className="text-sm text-destructive" role="alert">{error}</p>}</CardContent>
        <CardFooter className="mt-5"><Button className="w-full" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Join workspace</Button></CardFooter>
      </form>
    </Card>
  );
}
