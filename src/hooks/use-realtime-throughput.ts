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

// Persist across Next.js dev mode hot reloads (module re-evaluation resets
// module-level state).  The globalThis pattern keeps the sliding window intact
// so throughput doesn't drop to 0.0 after every HMR.
const g = globalThis as unknown as {
  __rtHistory?: Snapshot[];
  __rtThroughput?: Record<string, ServerThroughput>;
  __rtListeners?: Set<() => void>;
};
const history: Snapshot[] = (g.__rtHistory ??= []);
let throughput: Record<string, ServerThroughput> = (g.__rtThroughput ??= {});
const listeners: Set<() => void> = (g.__rtListeners ??= new Set());

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

/** Fallback: aggregate per-request tokens_per_second from running requests. */
function getPerRequestTps(server: ServerStatus): number {
  if (!server.vllm) return 0;
  const reqs = server.vllm.requests ?? [];
  return reqs.reduce((sum, r) => sum + (r.tokens_per_second ?? 0), 0);
}

function processData(serversData: ServersResponse) {
  const now = serversData.timestamp;
  const currentGen: Record<string, number> = {};
  const currentPrompt: Record<string, number> = {};
  // Collect per-request TPS fallback per server
  const perReqTps: Record<string, number> = {};

  for (const server of serversData.servers) {
    const tokens = getEffectiveTokens(server);
    if (tokens) {
      currentGen[server.config.id] = tokens.gen;
      currentPrompt[server.config.id] = tokens.prompt;
    }
    perReqTps[server.config.id] = getPerRequestTps(server);
  }

  const snap: Snapshot = { timestamp: now, genTokens: currentGen, promptTokens: currentPrompt };

  // Mutate the globalThis-backed array in-place so the reference persists.
  if (history.length >= WINDOW_SIZE) {
    history.splice(0, history.length - WINDOW_SIZE + 1);
  }
  history.push(snap);

  const next: Record<string, ServerThroughput> = {};

  if (history.length >= 2) {
    const oldest = history[0];
    const dt = (now - oldest.timestamp) / 1000;
    if (dt > 0) {
      for (const id of Object.keys(currentGen)) {
        const dGen = (currentGen[id] ?? 0) - (oldest.genTokens[id] ?? 0);
        const dPrompt = (currentPrompt[id] ?? 0) - (oldest.promptTokens[id] ?? 0);
        const deltaTps = dGen > 0 ? Math.round((dGen / dt) * 10) / 10 : 0;
        next[id] = {
          // Use delta-based throughput when available, fall back to aggregate
          // per-request TPS reported by the server (handles cold-start).
          generation: deltaTps > 0 ? deltaTps : Math.round((perReqTps[id] ?? 0) * 10) / 10,
          prompt: dPrompt > 0 ? Math.round((dPrompt / dt) * 10) / 10 : 0,
        };
      }
    }
  } else {
    // Cold-start: only 1 snapshot, use per-request TPS as fallback.
    for (const id of Object.keys(currentGen)) {
      next[id] = {
        generation: Math.round((perReqTps[id] ?? 0) * 10) / 10,
        prompt: 0,
      };
    }
  }

  throughput = next;
  g.__rtThroughput = throughput;
  notify();
}

export function useRealtimeThroughput(
  serversData: ServersResponse | undefined
): Record<string, ServerThroughput> {
  useEffect(() => {
    if (serversData) processData(serversData);
  }, [serversData]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
