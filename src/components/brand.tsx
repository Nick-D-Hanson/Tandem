import Link from "next/link";

import { cn } from "@/lib/utils";

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link href="/app" className={cn("inline-flex items-center gap-2.5 font-semibold tracking-tight", className)}>
      <span className="grid size-8 place-items-center rounded-[10px] bg-gradient-to-br from-blue-600 to-violet-600 text-sm font-bold text-white shadow-[0_6px_18px_rgba(37,99,235,.22)]">T</span>
      {!compact && <span>Tandem</span>}
    </Link>
  );
}
