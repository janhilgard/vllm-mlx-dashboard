"use client";

import { useEffect, useRef, useState } from "react";
import { ServersResponse, GpuResponse, TimeSeriesPoint } from "@/types";
import { counters } from "@/lib/counters";

const MAX_POINTS = 60;

interface PrevSnapshot {
  timestamp: number;
  tokens: Record<string, number>;
  prompt: Record<string, number>;
}

export function useTimeSeries(
  serversData: ServersResponse | undefined,
  gpuData: GpuResponse | undefined
) {
  const [history, setHistory] = useState<TimeSeriesPoint[]>([]);
  const prevRef = useRef<PrevSnapshot | null>(null);
  const lastProcessedRef = useRef<number>(0);

  useEffect(() => {
    if (!serversData) return;
    if (serversData.timestamp === lastProcessedRef.current) return;
    lastProcessedRef.current = serversData.timestamp;

    const now = serversData.timestamp;

    const point: TimeSeriesPoint = {
      timestamp: now,
      label: new Date(now).toLocaleTimeString("cs-CZ", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      gpuUtilization: gpuData?.gpu?.gpu_utilization_percent ?? null,
      gpuPower: gpuData?.gpu?.gpu_power_watts ?? null,
    };

    const currentTokens: Record<string, number> = {};
    const currentPrompt: Record<string, number> = {};

    for (const server of serversData.servers) {
      const id = server.config.id;

      const c = counters(server);
      if (c) {
        currentTokens[id] = c.gen;
        currentPrompt[id] = c.prompt;
        point[`${id}_requests`] = c.running;
        point[`${id}_waiting`] = c.waiting;
      }

      if (currentTokens[id] != null) {
        if (prevRef.current) {
          const prevTokens = prevRef.current.tokens[id];
          const dt = (now - prevRef.current.timestamp) / 1000;
          if (prevTokens != null && dt > 0) {
            const delta = currentTokens[id] - prevTokens;
            point[id] = delta > 0 ? Math.round((delta / dt) * 10) / 10 : 0;
            const prevPrompt = prevRef.current.prompt[id];
            const dp = prevPrompt != null ? currentPrompt[id] - prevPrompt : 0;
            point[`${id}_prompt`] = dp > 0 ? Math.round((dp / dt) * 10) / 10 : 0;
          } else {
            point[id] = 0;
            point[`${id}_prompt`] = 0;
          }
        } else {
          point[id] = 0;
          point[`${id}_prompt`] = 0;
        }
      }
    }

    prevRef.current = { timestamp: now, tokens: currentTokens, prompt: currentPrompt };

    setHistory((prev) => [...prev.slice(-(MAX_POINTS - 1)), point]);
  }, [serversData, gpuData]);

  return history;
}
