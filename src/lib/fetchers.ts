import { ServerConfig, ServerStatus, SlotInfo, VllmMlxStatus } from "@/types";
import { parsePrometheusMetrics } from "./prometheus-parser";

const FETCH_TIMEOUT = 3000;
const OFFLINE_THRESHOLD = 3;

// Persist across Next.js dev mode hot reloads (module re-evaluation resets module-level state)
const g = globalThis as unknown as {
  __fetcherFailures?: Map<number, number>;
  __fetcherLastVllm?: Map<number, VllmMlxStatus>;
};
const consecutiveFailures = (g.__fetcherFailures ??= new Map<number, number>());
const lastVllmData = (g.__fetcherLastVllm ??= new Map<number, VllmMlxStatus>());

function fetchWithTimeout(url: string, timeout = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { signal: controller.signal, cache: "no-store" }).finally(() =>
    clearTimeout(timer)
  );
}

export async function fetchLlamaCppStatus(config: ServerConfig): Promise<ServerStatus> {
  const base = `http://localhost:${config.port}`;

  const [healthResult, metricsResult, slotsResult] = await Promise.allSettled([
    fetchWithTimeout(`${base}/health`).then((r) => r.json()),
    fetchWithTimeout(`${base}/metrics`).then((r) => r.text()),
    fetchWithTimeout(`${base}/slots`).then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
  ]);

  let online: boolean;
  if (healthResult.status === "fulfilled") {
    consecutiveFailures.set(config.port, 0);
    online = true;
  } else {
    const count = (consecutiveFailures.get(config.port) || 0) + 1;
    consecutiveFailures.set(config.port, count);
    online = count < OFFLINE_THRESHOLD;
  }

  return {
    config,
    online,
    health: healthResult.status === "fulfilled" ? healthResult.value : undefined,
    metrics:
      metricsResult.status === "fulfilled"
        ? parsePrometheusMetrics(metricsResult.value)
        : undefined,
    slots:
      slotsResult.status === "fulfilled"
        ? (slotsResult.value as SlotInfo[])
        : undefined,
  };
}

export async function fetchVllmMlxStatus(config: ServerConfig): Promise<ServerStatus> {
  const base = `http://localhost:${config.port}`;

  const [healthResult, statusResult] = await Promise.allSettled([
    fetchWithTimeout(`${base}/health`).then((r) => r.json()),
    fetchWithTimeout(`${base}/v1/status`).then((r) => r.json()),
  ]);

  let online: boolean;
  if (healthResult.status === "fulfilled") {
    consecutiveFailures.set(config.port, 0);
    online = true;
  } else {
    const count = (consecutiveFailures.get(config.port) || 0) + 1;
    consecutiveFailures.set(config.port, count);
    online = count < OFFLINE_THRESHOLD;
  }

  const vllm = statusResult.status === "fulfilled"
    ? (statusResult.value as VllmMlxStatus)
    : healthResult.status === "fulfilled"
      ? (healthResult.value as VllmMlxStatus)
      : undefined;

  if (vllm) {
    lastVllmData.set(config.port, vllm);
  }

  return {
    config,
    online,
    vllm: vllm ?? (online ? lastVllmData.get(config.port) : undefined),
  };
}

export async function fetchServerStatus(config: ServerConfig): Promise<ServerStatus> {
  if (config.framework === "llama.cpp") {
    return fetchLlamaCppStatus(config);
  }
  return fetchVllmMlxStatus(config);
}
