import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="space-y-4">
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="text-2xl font-semibold">That shared item isn’t available</h1>
        <p className="text-muted-foreground">It may have been removed, or it belongs to another workspace.</p>
        <Button asChild><Link href="/app">Back to Tandem</Link></Button>
      </div>
    </main>
  );
}
