"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>Tandem couldn’t load this view. Your shared items are safe.</CardDescription>
        </CardHeader>
        <CardContent><Button onClick={reset}>Try again</Button></CardContent>
      </Card>
    </main>
  );
}
