self.addEventListener("push", (event) => {
  if (!event.data) return;
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data.json(); } catch { payload = {}; }
    const title = typeof payload.title === "string" ? payload.title : "Tandem activity summary";
    const body = typeof payload.body === "string" ? payload.body : "Your workspace has new activity.";
    const candidate = typeof payload.url === "string" ? payload.url : "/app/my-list?activity=open";
    const target = new URL(candidate, self.location.origin);
    const url = target.origin === self.location.origin && target.pathname.startsWith("/") ? `${target.pathname}${target.search}` : "/app/my-list?activity=open";
    await self.registration.showNotification(title, {
      body,
      icon: "/tandem-icon.svg",
      badge: "/tandem-icon.svg",
      tag: "tandem-daily-activity",
      renotify: false,
      data: { url },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const candidate = typeof event.notification.data?.url === "string" ? event.notification.data.url : "/app/my-list?activity=open";
    const target = new URL(candidate, self.location.origin);
    const url = target.origin === self.location.origin && target.pathname.startsWith("/") ? target.href : new URL("/app/my-list?activity=open", self.location.origin).href;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(url);
      return existing.focus();
    }
    return self.clients.openWindow(url);
  })());
});
