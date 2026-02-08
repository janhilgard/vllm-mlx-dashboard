export interface ServerConfig {
  id: string;
  name: string;
  port: number;
  framework: "llama.cpp" | "vllm-mlx";
  color: string;
}

export interface LlamaCppMetrics {
  predicted_tokens_seconds: number;
  prompt_tokens_seconds: number;
  tokens_predicted_total: number;
  prompt_tokens_total: number;
  requests_processing: number;
  requests_deferred: number;
  kv_cache_usage_ratio: number;
}

export interface SlotInfo {
  id: number;
  is_processing: boolean;
  task_id?: number;
}

export interface VllmMlxStatus {
  status: string;
  model: string;
  uptime_s: number;
  steps_executed: number;
  num_running: number;
  num_waiting: number;
  total_requests_processed: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  metal: {
    active_memory_gb: number;
    peak_memory_gb: number;
    cache_memory_gb: number;
  };
  cache: {
    hits: number;
    misses: number;
    hit_rate: number;
    evictions: number;
    tokens_saved: number;
    current_memory_mb: number;
    max_memory_mb: number;
    memory_utilization: number;
    entry_count: number;
  };
  requests: unknown[];
}

export interface ServerStatus {
  config: ServerConfig;
  online: boolean;
  health?: unknown;
  metrics?: LlamaCppMetrics;
  slots?: SlotInfo[];
  vllm?: VllmMlxStatus;
}

export interface GpuMetrics {
  gpu_utilization_percent: number | null;
  gpu_power_watts: number | null;
}

export interface ServersResponse {
  servers: ServerStatus[];
  timestamp: number;
}

export interface GpuResponse {
  gpu: GpuMetrics;
  timestamp: number;
}

export interface TimeSeriesPoint {
  timestamp: number;
  label: string;
  gpuUtilization: number | null;
  gpuPower: number | null;
  [serverId: string]: number | null | string;
}
