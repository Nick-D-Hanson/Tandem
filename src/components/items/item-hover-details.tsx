"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ItemHoverDetails({ children, title, description, meta }: {
  children: React.ReactElement;
  title: string;
  description?: string | null;
  meta?: string | null;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-80 whitespace-normal p-3 max-[820px]:hidden">
        <p className="font-semibold">{title}</p>
        {description && <p className="mt-1 text-xs opacity-90">{description}</p>}
        {meta && <p className="mt-1.5 text-[11px] opacity-70">{meta}</p>}
      </TooltipContent>
    </Tooltip>
  );
}
