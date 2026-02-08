import { LlamaCppMetrics } from "@/types";

const METRIC_KEYS: Record<string, keyof LlamaCppMetrics> = {
  "llamacpp:predicted_tokens_seconds": "predicted_tokens_seconds",
  "llamacpp:prompt_tokens_seconds": "prompt_tokens_seconds",
  "llamacpp:tokens_predicted_total": "tokens_predicted_total",
  "llamacpp:prompt_tokens_total": "prompt_tokens_total",
  "llamacpp:requests_processing": "requests_processing",
  "llamacpp:requests_deferred": "requests_deferred",
  "llamacpp:kv_cache_usage_ratio": "kv_cache_usage_ratio",
};

export function parsePrometheusMetrics(text: string): LlamaCppMetrics {
  const metrics: LlamaCppMetrics = {
    predicted_tokens_seconds: 0,
    prompt_tokens_seconds: 0,
    tokens_predicted_total: 0,
    prompt_tokens_total: 0,
    requests_processing: 0,
    requests_deferred: 0,
    kv_cache_usage_ratio: 0,
  };

  for (const line of text.split("\n")) {
    if (line.startsWith("#") || line.trim() === "") continue;

    // Split on last space - metric name may contain colons
    const lastSpace = line.lastIndexOf(" ");
    if (lastSpace === -1) continue;

    const name = line.substring(0, lastSpace);
    const value = parseFloat(line.substring(lastSpace + 1));
    if (isNaN(value)) continue;

    const key = METRIC_KEYS[name];
    if (key) {
      metrics[key] = value;
    }
  }

  return metrics;
}
