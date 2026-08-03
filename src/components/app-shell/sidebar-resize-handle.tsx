"use client";

import { cn } from "@/lib/utils";

export function SidebarResizeHandle({ label, side, value, min, max, onResize }: {
  label: string;
  side: "left" | "right";
  value: number;
  min: number;
  max: number;
  onResize: (delta: number) => void;
}) {
  const direction = side === "left" ? 1 : -1;

  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    let lastX = event.clientX;

    function move(moveEvent: PointerEvent) {
      onResize((moveEvent.clientX - lastX) * direction);
      lastX = moveEvent.clientX;
    }

    function stop() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

  return <div
    role="separator"
    tabIndex={0}
    aria-label={label}
    aria-orientation="vertical"
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuenow={value}
    className={cn("group absolute inset-y-0 z-20 hidden w-2 touch-none cursor-col-resize place-items-center outline-none min-[821px]:grid", side === "left" ? "-right-1" : "-left-1")}
    onPointerDown={startResize}
    onKeyDown={(event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      onResize((event.key === "ArrowRight" ? 16 : -16) * direction);
    }}
  >
    <span className="h-full w-px bg-transparent transition-colors group-hover:bg-primary/60 group-focus-visible:w-0.5 group-focus-visible:bg-primary" />
  </div>;
}
