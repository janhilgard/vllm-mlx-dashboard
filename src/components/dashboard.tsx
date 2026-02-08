"use client";

import { useMemo } from "react";
import { useServersData, useGpuData } from "@/hooks/use-dashboard-data";
import { useTimeSeries } from "@/hooks/use-time-series";
import { useRealtimeThroughput } from "@/hooks/use-realtime-throughput";
import { SERVERS } from "@/lib/server-config";
import { GlobalStats } from "./global-stats";
import { ServerCard } from "./server-card";
import { GpuChart } from "./gpu-chart";
import { ThroughputChart } from "./throughput-chart";
import { Skeleton } from "@/components/ui/skeleton";

export function Dashboard() {
  const { data: serversData, isLoading: serversLoading } = useServersData();
  const { data: gpuData } = useGpuData();
  const timeSeries = useTimeSeries(serversData, gpuData);
  const realtimeThroughput = useRealtimeThroughput(serversData);

  const aggregated = useMemo(() => {
    if (!serversData) return null;
    const online = serversData.servers.filter((s) => s.online);
    const llamacpp = online.filter((s) => s.metrics);
    const vllmServers = online.filter((s) => s.vllm);
    return {
      onlineCount: online.length,
      totalCount: serversData.servers.length,
      totalThroughput: llamacpp.reduce(
        (sum, s) => sum + (realtimeThroughput[s.config.id]?.generation ?? 0),
        0
      ),
      totalTokens: llamacpp.reduce(
        (sum, s) => sum + (s.metrics?.tokens_predicted_total ?? 0),
        0
      ) + vllmServers.reduce(
        (sum, s) => sum + (s.vllm?.total_completion_tokens ?? 0),
        0
      ),
      totalPromptTokens: llamacpp.reduce(
        (sum, s) => sum + (s.metrics?.prompt_tokens_total ?? 0),
        0
      ) + vllmServers.reduce(
        (sum, s) => sum + (s.vllm?.total_prompt_tokens ?? 0),
        0
      ),
      activeRequests: llamacpp.reduce(
        (sum, s) => sum + (s.metrics?.requests_processing ?? 0),
        0
      ) + vllmServers.reduce(
        (sum, s) => sum + (s.vllm?.num_running ?? 0),
        0
      ),
      deferredRequests: llamacpp.reduce(
        (sum, s) => sum + (s.metrics?.requests_deferred ?? 0),
        0
      ) + vllmServers.reduce(
        (sum, s) => sum + (s.vllm?.num_waiting ?? 0),
        0
      ),
      busySlots: serversData.servers.reduce(
        (sum, s) => sum + (s.slots?.filter((sl) => sl.is_processing).length ?? 0),
        0
      ),
      totalSlots: serversData.servers.reduce(
        (sum, s) => sum + (s.slots?.length ?? 0),
        0
      ),
    };
  }, [serversData, realtimeThroughput]);

  if (serversLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <GlobalStats stats={aggregated} gpu={gpuData?.gpu} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GpuChart data={timeSeries} />
        <ThroughputChart data={timeSeries} servers={SERVERS} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {serversData?.servers.map((server) => (
          <ServerCard
            key={server.config.id}
            server={server}
            throughput={realtimeThroughput[server.config.id]}
            history={timeSeries}
          />
        ))}
      </div>
    </div>
  );
}
