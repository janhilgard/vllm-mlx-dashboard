"use client";

import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  online: boolean;
  processing?: boolean;
}

export function StatusBadge({ online, processing }: StatusBadgeProps) {
  if (!online) {
    return (
      <Badge variant="destructive" className="text-xs">
        Offline
      </Badge>
    );
  }

  return (
    <Badge className="bg-emerald-600 text-white text-xs hover:bg-emerald-600">
      <span className={processing ? "animate-pulse" : ""}>Online</span>
    </Badge>
  );
}
