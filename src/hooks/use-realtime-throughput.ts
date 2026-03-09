"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ServerStatus, ServersResponse } from "@/types";

export interface ServerThroughput {
  generation: number;
  prompt: number;
}

interface Snapshot {
  timestamp: number;
  genTokens: Record<string, number>;
  promptTokens: Record<string, number>;
}

const WINDOW_SIZE = 15;

// Module-level store
let history: Snapshot[] = [];
let throughput: Record<string, ServerThroughput> = {};
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot() {
  return throughput;
}

function getEffectiveTokens(server: ServerStatus): { gen: number; prompt: number } | null {
  if (server.config.framework === "llama.cpp" && server.metrics) {
    return { gen: server.metrics.tokens_predicted_total, prompt: server.metrics.prompt_tokens_total };
  }
  if (server.vllm) {
    const reqs = server.vllm.requests ?? [];
    const inflightGen = reqs.reduce((s, r) => s + (r.completion_tokens ?? 0), 0);
    const inflightPrompt = reqs.reduce((s, r) => s + (r.prompt_tokens ?? 0), 0);
    return {
      gen: server.vllm.total_completion_tokens + inflightGen,
      prompt: server.vllm.total_prompt_tokens + inflightPrompt,
    };
  }
  return null;
}

function processData(serversData: ServersResponse) {
  const now = serversData.timestamp;
  const currentGen: Record<string, number> = {};
  const currentPrompt: Record<string, number> = {};

  for (const server of serversData.servers) {
    const tokens = getEffectiveTokens(server);
    if (tokens) {
      currentGen[server.config.id] = tokens.gen;
      currentPrompt[server.config.id] = tokens.prompt;
    }
  }

  const snap: Snapshot = { timestamp: now, genTokens: currentGen, promptTokens: currentPrompt };
  history = [...history.slice(-(WINDOW_SIZE - 1)), snap];

  if (history.length >= 2) {
    const oldest = history[0];
    const dt = (now - oldest.timestamp) / 1000;
    if (dt > 0) {
      const next: Record<string, ServerThroughput> = {};
      for (const id of Object.keys(currentGen)) {
        const dGen = (currentGen[id] ?? 0) - (oldest.genTokens[id] ?? 0);
        const dPrompt = (currentPrompt[id] ?? 0) - (oldest.promptTokens[id] ?? 0);
        next[id] = {
          generation: dGen > 0 ? Math.round((dGen / dt) * 10) / 10 : 0,
          prompt: dPrompt > 0 ? Math.round((dPrompt / dt) * 10) / 10 : 0,
        };
      }
      throughput = next;
      notify();
    }
  }
}

export function useRealtimeThroughput(
  serversData: ServersResponse | undefined
): Record<string, ServerThroughput> {
  useEffect(() => {
    if (serversData) processData(serversData);
  }, [serversData]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
