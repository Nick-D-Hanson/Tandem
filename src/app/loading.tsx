import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6" aria-label="Loading Tandem">
      <div className="w-full max-w-md space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-52 w-full rounded-xl" />
      </div>
    </main>
  );
}
