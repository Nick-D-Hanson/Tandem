import { Brand } from "@/components/brand";

export function AuthShell({ children, eyebrow }: { children: React.ReactNode; eyebrow: string }) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-background p-4 sm:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_oklab,var(--primary)_10%,transparent),transparent_42%)]" />
      <section className="relative w-full max-w-md space-y-7">
        <div className="flex flex-col items-center gap-3 text-center">
          <Brand />
          <p className="text-sm text-muted-foreground">{eyebrow}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
