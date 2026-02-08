"use client";

import { SlotInfo } from "@/types";

interface SlotIndicatorProps {
  slots: SlotInfo[];
}

export function SlotIndicator({ slots }: SlotIndicatorProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">Slots</span>
      <div className="flex gap-1">
        {slots.map((slot) => (
          <div
            key={slot.id}
            className={`w-3 h-3 rounded-sm ${
              slot.is_processing
                ? "bg-amber-500 animate-pulse"
                : "bg-emerald-600/30 border border-emerald-600/50"
            }`}
            title={slot.is_processing ? `Slot ${slot.id}: busy` : `Slot ${slot.id}: idle`}
          />
        ))}
      </div>
    </div>
  );
}
