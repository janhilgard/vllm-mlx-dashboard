"use client";

import { useEffect, useRef, useState } from "react";
import { ServersResponse, GpuResponse, TimeSeriesPoint } from "@/types";

const MAX_POINTS = 60;

interface PrevSnapshot {
  timestamp: number;
  tokens: Record<string, number>;
}

export function useTimeSeries(
  serversData: ServersResponse | undefined,
  gpuData: GpuResponse | undefined
) {
  const historyRef = useRef<TimeSeriesPoint[]>([]);
  const prevRef = useRef<PrevSnapshot | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!serversData) return;

    const now = Date.now();

    const point: TimeSeriesPoint = {
      timestamp: now,
      label: new Date().toLocaleTimeString("cs-CZ", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      gpuUtilization: gpuData?.gpu?.gpu_utilization_percent ?? null,
      gpuPower: gpuData?.gpu?.gpu_power_watts ?? null,
    };

    const currentTokens: Record<string, number> = {};

    for (const server of serversData.servers) {
      if (server.config.framework === "llama.cpp" && server.metrics) {
        const id = server.config.id;
        currentTokens[id] = server.metrics.tokens_predicted_total;

        if (prevRef.current) {
          const prevTokens = prevRef.current.tokens[id];
          const dt = (now - prevRef.current.timestamp) / 1000;
          if (prevTokens != null && dt > 0) {
            const delta = currentTokens[id] - prevTokens;
            point[id] = delta > 0 ? Math.round((delta / dt) * 10) / 10 : 0;
          } else {
            point[id] = 0;
          }
        } else {
          point[id] = 0;
        }
      }
    }

    prevRef.current = { timestamp: now, tokens: currentTokens };

    historyRef.current = [...historyRef.current.slice(-(MAX_POINTS - 1)), point];
    setTick((t) => t + 1);
  }, [serversData, gpuData]);

  return historyRef.current;
}
