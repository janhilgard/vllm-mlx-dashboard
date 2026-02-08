import { ServerConfig, ServerStatus, SlotInfo, VllmMlxStatus } from "@/types";
import { parsePrometheusMetrics } from "./prometheus-parser";

const FETCH_TIMEOUT = 1500;

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
    fetchWithTimeout(`${base}/slots`).then((r) => r.json()),
  ]);

  const online = healthResult.status === "fulfilled";

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

  const online = healthResult.status === "fulfilled";

  return {
    config,
    online,
    vllm: statusResult.status === "fulfilled"
      ? (statusResult.value as VllmMlxStatus)
      : healthResult.status === "fulfilled"
        ? (healthResult.value as VllmMlxStatus)
        : undefined,
  };
}

export async function fetchServerStatus(config: ServerConfig): Promise<ServerStatus> {
  if (config.framework === "llama.cpp") {
    return fetchLlamaCppStatus(config);
  }
  return fetchVllmMlxStatus(config);
}
