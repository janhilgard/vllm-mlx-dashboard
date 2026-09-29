"use client";

import { useMemo } from "react";
import { useServersData, useGpuData } from "@/hooks/use-dashboard-data";
import { useTimeSeries } from "@/hooks/use-time-series";
import { useRealtimeThroughput } from "@/hooks/use-realtime-throughput";
import { SERVERS } from "@/lib/server-config";
import { GlobalStats } from "./global-stats";
import { ServerCard } from "./server-card";
import { SplashCard } from "./splash-card";
import { OmlxCard } from "./omlx-card";
import { SystemCard } from "./system-card";
import { LoadHistory } from "./load-history";
import { counters } from "@/lib/counters";
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
    // One counter view per engine (lib/counters) — llama.cpp, vllm-mlx, oMLX
    // and Splash report the same things under different names.
    const c = online.map(counters).filter((x): x is NonNullable<typeof x> => x != null);
    return {
      onlineCount: online.length,
      totalCount: serversData.servers.length,
      totalThroughput: online.reduce(
        (sum, s) => sum + (realtimeThroughput[s.config.id]?.generation ?? 0),
        0
      ),
      totalTokens: c.reduce((sum, x) => sum + x.gen, 0),
      totalPromptTokens: c.reduce((sum, x) => sum + x.prompt, 0),
      activeRequests: c.reduce((sum, x) => sum + x.running, 0),
      deferredRequests: c.reduce((sum, x) => sum + x.waiting, 0),
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

      <LoadHistory />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GpuChart data={timeSeries} />
        <ThroughputChart data={timeSeries} servers={SERVERS} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SystemCard system={gpuData?.system} gpu={gpuData?.gpu} />
        {serversData?.servers.map((server) =>
          server.config.framework === "splash" ? (
            <SplashCard key={server.config.id} server={server} history={timeSeries} timestamp={serversData.timestamp} />
          ) : server.config.framework === "omlx" ? (
            <OmlxCard key={server.config.id} server={server} throughput={realtimeThroughput[server.config.id]} history={timeSeries} />
          ) : (
            <ServerCard
              key={server.config.id}
              server={server}
              throughput={realtimeThroughput[server.config.id]}
              history={timeSeries}
            />
          )
        )}
      </div>
    </div>
  );
}
