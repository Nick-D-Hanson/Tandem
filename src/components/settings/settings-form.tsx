"use client";

import { ArrowLeft, Copy, Link2, Loader2, LogOut, Moon, Sun, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Brand } from "@/components/brand";
import { initials } from "@/components/tasks/task-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createInviteAction, updateWorkspaceAction } from "@/lib/actions/workspace";
import { authClient } from "@/lib/auth/client";
import type { AppData } from "@/lib/types";

export function SettingsForm({ data }: { data: AppData }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();
  const [inviteLink, setInviteLink] = useState("");

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await updateWorkspaceAction({ name: String(formData.get("name") || ""), timezone: String(formData.get("timezone") || "") });
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("Workspace updated");
      router.refresh();
    });
  }

  function invite() {
    startTransition(async () => {
      const result = await createInviteAction();
      if (!result.ok) { toast.error(result.error); return; }
      setInviteLink(result.data.inviteLink);
      await navigator.clipboard.writeText(result.data.inviteLink);
      toast.success("Invite link copied");
    });
  }

  async function signOut() {
    await authClient.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <main className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur"><div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4"><Brand /><Button asChild variant="ghost"><Link href="/app"><ArrowLeft />Back to calendar</Link></Button></div></header>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <div className="mb-7"><h1 className="text-2xl font-semibold tracking-tight">Settings</h1><p className="text-muted-foreground">Manage the shared space and your Tandem preferences.</p></div>
        <Tabs defaultValue="workspace"><TabsList><TabsTrigger value="workspace">Workspace</TabsTrigger><TabsTrigger value="members">Members</TabsTrigger><TabsTrigger value="appearance">Appearance</TabsTrigger></TabsList>
          <TabsContent value="workspace" className="mt-5"><Card><CardHeader><CardTitle>Shared workspace</CardTitle><CardDescription>These settings control how dates and times appear for both members.</CardDescription></CardHeader><form action={save}><CardContent className="space-y-5"><div className="space-y-2"><Label htmlFor="settings-name">Workspace name</Label><Input id="settings-name" name="name" defaultValue={data.workspace.name} required /></div><div className="space-y-2"><Label htmlFor="settings-timezone">Timezone</Label><Input id="settings-timezone" name="timezone" defaultValue={data.workspace.timezone} required /><p className="text-xs text-muted-foreground">Use an IANA timezone. Changing this alters display, not stored UTC instants.</p></div></CardContent><CardFooter className="mt-5"><Button disabled={pending}>{pending && <Loader2 className="animate-spin" />}Save changes</Button></CardFooter></form></Card></TabsContent>
          <TabsContent value="members" className="mt-5 space-y-5"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-5" />Members</CardTitle><CardDescription>Tandem workspaces contain exactly two equal members.</CardDescription></CardHeader><CardContent className="space-y-3">{data.members.map((member, index) => <div key={member.userId} className="flex items-center gap-3 rounded-xl border p-3"><span className={`grid size-10 place-items-center rounded-full text-xs font-bold text-white ${index === 1 ? "bg-teal-700" : "bg-blue-600"}`}>{initials(member.displayName)}</span><div><p className="font-medium">{member.displayName}</p><p className="text-xs text-muted-foreground">Equal editing access</p></div></div>)}{data.members.length < 2 && <div className="space-y-3 rounded-xl border border-dashed p-4"><p className="font-medium">One seat is open</p><p className="text-sm text-muted-foreground">Generate a new seven-day link. Any prior unused invite will be revoked.</p><Button variant="outline" onClick={invite} disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Link2 />}Create & copy invite</Button>{inviteLink && <div className="flex gap-2"><Input value={inviteLink} readOnly aria-label="Invite link" /><Button variant="outline" size="icon" onClick={() => navigator.clipboard.writeText(inviteLink)} aria-label="Copy invite"><Copy /></Button></div>}</div>}</CardContent></Card></TabsContent>
          <TabsContent value="appearance" className="mt-5"><Card><CardHeader><CardTitle>Appearance</CardTitle><CardDescription>Choose the theme on this device.</CardDescription></CardHeader><CardContent className="grid grid-cols-2 gap-3"><Button variant={resolvedTheme === "light" ? "default" : "outline"} onClick={() => setTheme("light")}><Sun />Light</Button><Button variant={resolvedTheme === "dark" ? "default" : "outline"} onClick={() => setTheme("dark")}><Moon />Dark</Button><Separator className="col-span-2 my-3" /><Button variant="outline" className="col-span-2 justify-start" onClick={signOut}><LogOut />Sign out</Button></CardContent></Card></TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
