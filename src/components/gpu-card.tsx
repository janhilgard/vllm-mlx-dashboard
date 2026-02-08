"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { GpuMetrics } from "@/types";

interface GpuCardProps {
  gpu: GpuMetrics | undefined;
}

export function GpuCard({ gpu }: GpuCardProps) {
  const utilization = gpu?.gpu_utilization_percent;
  const power = gpu?.gpu_power_watts;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">GPU (Apple Silicon)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Utilization</span>
            <span className="font-mono tabular-nums">
              {utilization != null ? `${utilization.toFixed(1)}%` : "N/A"}
            </span>
          </div>
          <Progress value={utilization ?? 0} className="h-2" />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Power</span>
          <span className="font-mono tabular-nums">
            {power != null ? `${power.toFixed(1)} W` : "N/A"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
