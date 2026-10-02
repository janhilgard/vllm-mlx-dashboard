export type Framework = "llama.cpp" | "vllm-mlx" | "omlx" | "splash";

export interface ServerConfig {
  id: string;
  name: string;
  port: number;
  framework: Framework;
  color: string;
  modelId?: string;
  /** Name of the env var holding the bearer token the server requires
   *  (read server-side only, never sent to the browser). */
  apiKeyEnv?: string;
  /** One-line role of the server, shown on its card. */
  role?: string;
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

export interface VllmRequest {
  request_id: string;
  status: string;
  phase: string;
  completion_tokens: number;
  prompt_tokens: number;
  max_tokens: number;
  tokens_per_second: number | null;
  progress: number;
  elapsed_s: number;
  ttft_s: number | null;
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
  generation_tps?: number;
  prompt_tps?: number;
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
  } | null;
  // SimpleEngine system-prompt KV snapshot (cross-request reuse of identical
  // system prefixes). Null on BatchedEngine, which uses the `cache` block.
  system_kv_cache?: {
    enabled: boolean;
    tokens: number;
    hash: string | null;
    memory_mb: number;
    hits: number;
    misses: number;
    hit_rate: number;
    tokens_saved: number;
  } | null;
  requests: VllmRequest[];
}

/* ---------------- oMLX (multi-model MLX server, port 8000) ---------------- */

export interface OmlxWaiting {
  request_id: string;
  queue_position: number;
  elapsed_seconds: number;
  prompt_tokens: number;
}

export interface OmlxPrefill {
  request_id: string;
  processed: number;
  total: number;
  speed: number;
  eta: number | null;
  elapsed: number;
  phase: string;
  cached_tokens?: number;
}

export interface OmlxGenerating {
  request_id: string;
  elapsed_seconds: number | null;
  generated_tokens: number;
  tokens_per_second: number;
  last_activity_age_seconds: number | null;
  prompt_tokens: number;
  max_tokens: number | null;
}

export interface OmlxModel {
  id: string;
  size_bytes: number;
  pinned: boolean;
  is_loading: boolean;
  loading_remaining_seconds: number | null;
  active_requests: number;
  waiting_requests: number;
  idle_seconds: number | null;
  ttl_remaining_seconds: number | null;
  dflash: boolean;
  waiting: OmlxWaiting[];
  prefilling: OmlxPrefill[];
  generating: OmlxGenerating[];
  /** Prefix cache of this model (runtime_cache). */
  cache: {
    block_size: number;
    indexed_blocks: number;
    ssd_bytes: number;
    ssd_max_bytes: number;
    hot_bytes: number;
    hot_max_bytes: number;
  } | null;
}

export interface OmlxTotals {
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens: number;
  cache_efficiency: number;
  avg_prefill_tps: number;
  avg_generation_tps: number;
  uptime_seconds: number;
}

export interface OmlxStatus {
  models: OmlxModel[];
  memory_used_bytes: number;
  memory_max_bytes: number;
  memory_soft_bytes: number | null;
  memory_hard_bytes: number | null;
  pressure: string;
  total_active: number;
  total_waiting: number;
  session: OmlxTotals | null;
  alltime: OmlxTotals | null;
  /** Models installed but not loaded (id + size). */
  available: { id: string; size_bytes: number }[];
}

/* --------------- Splash (DFlash2 engine, port 8001) --------------- */

export interface SplashBatch {
  width: number;
  input_tokens: number;
  output_tokens: number;
  tokens_per_second: number;
  wall_ms: number;
}

/** One live request on a Splash server (/status active_requests). */
export interface SplashActiveRequest {
  id: number;
  phase: string;
  prompt_tokens: number;
  /** Prompt tokens already encoded, prefix-cache hits included. */
  prompt_processed: number;
  generated_tokens: number;
  max_new_tokens: number;
  age_ms: number;
}

export interface SplashStatus {
  ready: boolean;
  model: string;
  started_at: number | null;
  max_context: number;
  max_batch_width: number;
  memory_pressure: string;
  memory_current_bytes: number;
  memory_peak_bytes: number;
  memory_budget_bytes: number;
  /** Where requests are right now. */
  stages: {
    http_active: number;
    http_capacity: number;
    preparing: number;
    preparing_waiting: number;
    queued: number;
    admission_waiting: number;
    waiting_memory: number;
    waiting_prefix: number;
    waiting_mask: number;
    prefilling: number;
    decoding: number;
  };
  requests: { submitted: number; completed: number; cancelled: number; failed: number };
  /** Cumulative counters — rates come from their deltas. */
  prefill_input_tokens: number;
  prefill_wall_ms: number;
  decode_output_tokens: number;
  decode_wall_ms: number;
  ttft_p50_ms: number | null;
  ttft_p95_ms: number | null;
  itl_p50_ms: number | null;
  itl_p95_ms: number | null;
  draft_acceptance: number | null;
  drafted_tokens: number;
  accepted_draft_tokens: number;
  capacity_failures: number;
  metal_failures: number;
  current_prefill: SplashBatch | null;
  current_decode: SplashBatch | null;
  /** Null when the server does not report its requests (Splash builds before 2 Oct 2026). */
  active_requests: SplashActiveRequest[] | null;
  decode_width: Record<string, number>;
  cache: { lookups: number; hits: number; hit_rate: number; reused_tokens: number; cold_misses: number };
  kv: { pages_total: number; pages_active: number; pages_cache: number; cache_bytes: number };
  transport_restarts: number;
}

export interface ServerStatus {
  config: ServerConfig;
  online: boolean;
  health?: unknown;
  metrics?: LlamaCppMetrics;
  slots?: SlotInfo[];
  vllm?: VllmMlxStatus;
  omlx?: OmlxStatus;
  splash?: SplashStatus;
  error?: string;
}

export interface GpuMetrics {
  gpu_utilization_percent: number | null;
  gpu_power_watts: number | null;
}

export interface ServersResponse {
  servers: ServerStatus[];
  timestamp: number;
}

export interface ProcessInfo {
  name: string;
  pid: number;
  cpu_percent: number;
  rss_bytes: number;
}

export interface SystemMetrics {
  memory_total_bytes: number;
  memory_used_bytes: number;
  memory_wired_bytes: number;
  memory_compressed_bytes: number;
  memory_cached_bytes: number;
  swap_used_bytes: number;
  swap_total_bytes: number;
  load: [number, number, number];
  cpu_count: number;
  processes: ProcessInfo[];
}

export interface GpuResponse {
  gpu: GpuMetrics;
  system?: SystemMetrics;
  timestamp: number;
}

export interface TimeSeriesPoint {
  timestamp: number;
  label: string;
  gpuUtilization: number | null;
  gpuPower: number | null;
  [serverId: string]: number | null | string;
}

/* ------------------ Load history (server-side sampler) ------------------ */

export interface LoadSample {
  t: number;
  cpu: number | null;
  gpu: number | null;
  gpu_w: number | null;
  mem_used: number | null;
  mem_total: number | null;
  swap_used: number | null;
  load1: number | null;
  engines: Record<string, { running: number; waiting: number; gen_tps: number | null; prompt_tps: number | null }>;
}

/** One bucket of the history chart: average and peak over the bucket. */
export interface LoadPoint {
  t: number;
  label: string;
  cpu: number | null; cpu_max: number | null;
  gpu: number | null; gpu_max: number | null;
  gpu_w: number | null;
  mem_gb: number | null; swap_gb: number | null;
  load1: number | null;
  running: number | null; running_max: number | null;
  waiting: number | null; waiting_max: number | null;
  gen_tps: number | null; prompt_tps: number | null;
  [engineKey: string]: number | null | string;
}

export interface LoadHistoryResponse {
  points: LoadPoint[];
  bucket_s: number;
  samples: number;
  mem_total_gb: number | null;
  engines: string[];
  from: number;
  to: number;
}
