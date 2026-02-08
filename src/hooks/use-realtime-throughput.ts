"use client";

import { useEffect, useRef, useState } from "react";
import { ServersResponse } from "@/types";

export interface ServerThroughput {
  generation: number;
  prompt: number;
}

interface Snapshot {
  timestamp: number;
  genTokens: Record<string, number>;
  promptTokens: Record<string, number>;
}

export function useRealtimeThroughput(
  serversData: ServersResponse | undefined
): Record<string, ServerThroughput> {
  const prevRef = useRef<Snapshot | null>(null);
  const [throughput, setThroughput] = useState<Record<string, ServerThroughput>>({});

  useEffect(() => {
    if (!serversData) return;

    const now = Date.now();
    const currentGen: Record<string, number> = {};
    const currentPrompt: Record<string, number> = {};

    for (const server of serversData.servers) {
      if (server.config.framework === "llama.cpp" && server.metrics) {
        currentGen[server.config.id] = server.metrics.tokens_predicted_total;
        currentPrompt[server.config.id] = server.metrics.prompt_tokens_total;
      }
    }

    if (prevRef.current) {
      const dt = (now - prevRef.current.timestamp) / 1000;
      if (dt > 0) {
        const next: Record<string, ServerThroughput> = {};
        for (const id of Object.keys(currentGen)) {
          const dGen = (currentGen[id] ?? 0) - (prevRef.current.genTokens[id] ?? 0);
          const dPrompt = (currentPrompt[id] ?? 0) - (prevRef.current.promptTokens[id] ?? 0);
          next[id] = {
            generation: dGen > 0 ? Math.round((dGen / dt) * 10) / 10 : 0,
            prompt: dPrompt > 0 ? Math.round((dPrompt / dt) * 10) / 10 : 0,
          };
        }
        setThroughput(next);
      }
    }

    prevRef.current = { timestamp: now, genTokens: currentGen, promptTokens: currentPrompt };
  }, [serversData]);

  return throughput;
}
