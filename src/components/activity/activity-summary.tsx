"use client";

import { Bell, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PushOptIn } from "@/components/activity/push-opt-in";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { loadMoreActivityAction, markActivitySeenAction } from "@/lib/actions/activity";
import { activityDayKey, activityDayLabel, activitySentence, exactActivityTime, mergeActivityItems, relativeActivityTime } from "@/lib/activity/format";
import type { ActivityItemView, ActivityPage } from "@/lib/activity/types";

export function ActivitySummary({ initialData, initialOpen = false }: { initialData: ActivityPage; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const [activityState, setActivityState] = useState(() => ({
    source: initialData,
    items: initialData.items,
    nextCursor: initialData.nextCursor,
    unreadCount: initialOpen ? 0 : initialData.unreadCount,
  }));
  const [loadError, setLoadError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!initialOpen || !initialData.items[0]) return;
    const newest = initialData.items[0];
    void markActivitySeenAction({ id: newest.id, occurredAt: newest.occurredAt }).then((result) => {
      if (!result.ok) toast.error(result.error);
    });
  }, [initialData.items, initialOpen]);

  if (activityState.source !== initialData) setActivityState({
    source: initialData,
    items: initialData.items,
    nextCursor: initialData.nextCursor,
    unreadCount: open ? activityState.unreadCount : initialData.unreadCount,
  });
  const { items, nextCursor, unreadCount } = activityState;

  const groups = useMemo(() => {
    const grouped = new Map<string, ActivityItemView[]>();
    for (const item of items) {
      const key = activityDayKey(item.occurredAt, initialData.workspaceTimezone);
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    }
    return Array.from(grouped);
  }, [initialData.workspaceTimezone, items]);

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen || !items[0]) return;
    setActivityState((state) => ({ ...state, unreadCount: 0 }));
    startTransition(async () => {
      const result = await markActivitySeenAction({ id: items[0].id, occurredAt: items[0].occurredAt });
      if (!result.ok) {
        setActivityState((state) => ({ ...state, unreadCount: initialData.unreadCount }));
        toast.error(result.error);
      }
    });
  }

  function loadMore() {
    if (!nextCursor) return;
    setLoadError("");
    startTransition(async () => {
      const result = await loadMoreActivityAction(nextCursor);
      if (!result.ok) {
        setLoadError(result.error);
        toast.error(result.error);
        return;
      }
      setActivityState((state) => {
        return {
          ...state,
          items: mergeActivityItems(state.items, result.data.items),
          nextCursor: result.data.nextCursor,
        };
      });
    });
  }

  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);
  return <Sheet open={open} onOpenChange={changeOpen}>
    <SheetTrigger asChild>
      <Button type="button" variant="ghost" size="icon" className="relative shrink-0" aria-label={unreadCount ? `Activity Summary, ${unreadCount} unread updates` : "Activity Summary"}>
        <Bell />
        {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid min-w-4.5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-[18px] text-white" aria-hidden="true">{badgeLabel}</span>}
      </Button>
    </SheetTrigger>
    <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
      <SheetHeader className="border-b px-5 py-4 text-left">
        <SheetTitle>Activity Summary</SheetTitle>
        <SheetDescription>{initialData.unreadCount > 0 ? `${initialData.unreadCount} ${initialData.unreadCount === 1 ? "update" : "updates"} since you last viewed.` : "Recent workspace Task and Event updates."}</SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="mb-5"><PushOptIn /></div>
        {items.length === 0 ? <div className="grid min-h-52 place-items-center rounded-xl border border-dashed bg-muted/20 px-5 text-center"><div><Bell className="mx-auto mb-3 size-6 text-muted-foreground" /><p className="font-medium">No activity yet</p><p className="mt-1 text-sm text-muted-foreground">Task and Event updates from your workspace will appear here.</p></div></div> : <div className="space-y-6">
          {groups.map(([day, dayItems]) => <section key={day} aria-labelledby={`activity-day-${day}`}>
            <h3 id={`activity-day-${day}`} className="sticky top-0 z-10 mb-2 bg-background/95 py-1 text-xs font-bold uppercase tracking-[.08em] text-muted-foreground backdrop-blur">{activityDayLabel(day, initialData.workspaceTimezone)}</h3>
            <div className="space-y-2">{dayItems.map((item) => <ActivityEntry key={item.id} item={item} viewerId={initialData.currentUserId} timezone={initialData.workspaceTimezone} />)}</div>
          </section>)}
          {loadError && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert"><p>{loadError}</p><Button type="button" variant="outline" size="sm" className="mt-2" disabled={pending} onClick={loadMore}>Try again</Button></div>}
          {nextCursor && !loadError && <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={loadMore}>{pending ? <Loader2 className="animate-spin" /> : null}Load more</Button>}
        </div>}
      </div>
    </SheetContent>
  </Sheet>;
}

function ActivityEntry({ item, viewerId, timezone }: { item: ActivityItemView; viewerId: string; timezone: string }) {
  const exact = exactActivityTime(item.occurredAt, timezone);
  return <article tabIndex={0} className="rounded-xl border bg-card p-3.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${activitySentence(item, viewerId)} ${exact}`}>
    <div className="flex items-start gap-3">
      <span className="mt-1 size-2.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm leading-5">{activitySentence(item, viewerId)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{item.entityType === "task" ? "Task" : "Event"}</span>
          {item.actionType === "deleted" && <span className="rounded-full border border-destructive/30 px-2 py-0.5 font-medium text-destructive">Removed</span>}
          <time dateTime={item.occurredAt} title={exact}>{relativeActivityTime(item.occurredAt)}</time>
        </div>
      </div>
    </div>
  </article>;
}
