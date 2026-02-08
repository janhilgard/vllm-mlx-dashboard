"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { GpuMetrics } from "@/types";
import { formatNumber } from "./metric-value";

interface AggregatedStats {
  onlineCount: number;
  totalCount: number;
  totalThroughput: number;
  totalTokens: number;
  totalPromptTokens: number;
  activeRequests: number;
  deferredRequests: number;
  busySlots: number;
  totalSlots: number;
}

interface GlobalStatsProps {
  stats: AggregatedStats | null;
  gpu: GpuMetrics | undefined;
}

export function GlobalStats({ stats, gpu }: GlobalStatsProps) {
  if (!stats) return null;

  const onlineColor =
    stats.onlineCount === stats.totalCount
      ? "text-emerald-400"
      : stats.onlineCount === 0
        ? "text-red-400"
        : "text-amber-400";

  const slotPercent =
    stats.totalSlots > 0 ? (stats.busySlots / stats.totalSlots) * 100 : 0;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex flex-wrap gap-6 items-end">
          <StatBlock label="Servers Online">
            <span className={`text-2xl font-bold font-mono tabular-nums ${onlineColor}`}>
              {stats.onlineCount}/{stats.totalCount}
            </span>
          </StatBlock>

          <StatBlock label="Total Throughput">
            <span className="text-2xl font-bold font-mono tabular-nums">
              {stats.totalThroughput.toFixed(1)}
              <span className="text-sm text-muted-foreground ml-1">tok/s</span>
            </span>
          </StatBlock>

          <StatBlock label="Tokens Generated">
            <span className="text-lg font-bold font-mono tabular-nums">
              {formatNumber(stats.totalTokens)}
            </span>
          </StatBlock>

          <StatBlock label="Prompt Tokens">
            <span className="text-lg font-bold font-mono tabular-nums">
              {formatNumber(stats.totalPromptTokens)}
            </span>
          </StatBlock>

          <StatBlock label="Active Requests">
            <span className="text-lg font-bold font-mono tabular-nums">
              {stats.activeRequests}
            </span>
          </StatBlock>

          <StatBlock label="Deferred Requests">
            <span
              className={`text-lg font-bold font-mono tabular-nums ${
                stats.deferredRequests > 0 ? "text-red-400" : ""
              }`}
            >
              {stats.deferredRequests}
            </span>
          </StatBlock>

          <StatBlock label={`Slots (${stats.busySlots}/${stats.totalSlots})`}>
            <div className="w-24">
              <Progress value={slotPercent} className="h-2" />
            </div>
          </StatBlock>

          <StatBlock label="GPU">
            <div className="flex items-center gap-2">
              <div className="w-20">
                <Progress value={gpu?.gpu_utilization_percent ?? 0} className="h-2" />
              </div>
              <span className="text-xs font-mono tabular-nums text-muted-foreground">
                {gpu?.gpu_utilization_percent != null
                  ? `${gpu.gpu_utilization_percent.toFixed(0)}%`
                  : "N/A"}
                {gpu?.gpu_power_watts != null && ` / ${gpu.gpu_power_watts.toFixed(0)}W`}
              </span>
            </div>
          </StatBlock>
        </div>
      </CardContent>
    </Card>
  );
}

function StatBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
