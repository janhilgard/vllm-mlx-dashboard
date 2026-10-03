import {
  OmlxModel, OmlxStatus, OmlxTotals, ServerConfig, ServerStatus, SlotInfo, SplashBatch, SplashStatus, VllmMlxStatus,
} from "@/types";
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

function fetchWithTimeout(url: string, timeout = FETCH_TIMEOUT, headers?: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { signal: controller.signal, cache: "no-store", headers }).finally(() =>
    clearTimeout(timer)
  );
}

/** Authorization header for servers that require a bearer token. The token
 *  lives in a server-side env var and never reaches the browser. */
export function authHeaders(config: ServerConfig): Record<string, string> {
  const key = config.apiKeyEnv ? process.env[config.apiKeyEnv] : undefined;
  return key ? { Authorization: `Bearer ${key}` } : {};
}

function markOnline(port: number, ok: boolean): boolean {
  if (ok) {
    consecutiveFailures.set(port, 0);
    return true;
  }
  const count = (consecutiveFailures.get(port) || 0) + 1;
  consecutiveFailures.set(port, count);
  return count < OFFLINE_THRESHOLD;
}

const num = (v: unknown): number => (typeof v === "number" && isFinite(v) ? v : Number(v) || 0);
const numOrNull = (v: unknown): number | null =>
  v == null || !isFinite(Number(v)) ? null : Number(v);

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

/* ------------------------------ oMLX ------------------------------ */

type Rec = Record<string, unknown>;

function omlxTotals(raw: Rec | null): OmlxTotals | null {
  // ⚠️ `/admin/api/stats` also returns the server's `api_key` in plain text.
  // Only the named fields below are copied — never pass the object through.
  if (!raw || raw.total_requests == null) return null;
  return {
    requests: num(raw.total_requests),
    prompt_tokens: num(raw.total_prompt_tokens),
    completion_tokens: num(raw.total_completion_tokens),
    cached_tokens: num(raw.total_cached_tokens),
    cache_efficiency: num(raw.cache_efficiency),
    avg_prefill_tps: num(raw.avg_prefill_tps),
    avg_generation_tps: num(raw.avg_generation_tps),
    uptime_seconds: num(raw.uptime_seconds),
  };
}

export async function fetchOmlxStatus(config: ServerConfig): Promise<ServerStatus> {
  const base = `http://localhost:${config.port}/admin/api`;
  const [act, ses, all, mods] = await Promise.allSettled([
    fetchWithTimeout(`${base}/activity`).then((r) => r.json() as Promise<Rec>),
    fetchWithTimeout(`${base}/stats?scope=session`).then((r) => r.json() as Promise<Rec>),
    fetchWithTimeout(`${base}/stats?scope=alltime`).then((r) => r.json() as Promise<Rec>),
    fetchWithTimeout(`${base}/models`, 5000).then((r) => r.json() as Promise<Rec>),
  ]);
  const online = markOnline(config.port, act.status === "fulfilled");
  if (act.status !== "fulfilled") return { config, online, error: "activity unavailable" };

  const am = (act.value.active_models ?? {}) as Rec;
  const session = ses.status === "fulfilled" ? ses.value : null;
  const cacheById = new Map<string, Rec>();
  const rc = (session?.runtime_cache ?? {}) as Rec;
  for (const m of (rc.models as Rec[] | undefined) ?? []) cacheById.set(String(m.id), m);

  const models: OmlxModel[] = ((am.models as Rec[] | undefined) ?? []).map((m) => {
    const c = cacheById.get(String(m.id));
    return {
      id: String(m.id),
      size_bytes: num(m.actual_size || m.estimated_size),
      pinned: !!m.pinned,
      is_loading: !!m.is_loading,
      loading_remaining_seconds: numOrNull(m.loading_remaining_seconds_estimate),
      active_requests: num(m.active_requests),
      waiting_requests: num(m.waiting_requests),
      idle_seconds: numOrNull(m.idle_seconds),
      ttl_remaining_seconds: numOrNull(m.ttl_remaining_seconds),
      dflash: m.dflash != null,
      waiting: ((m.waiting as Rec[] | undefined) ?? []).map((w) => ({
        request_id: String(w.request_id), queue_position: num(w.queue_position),
        elapsed_seconds: num(w.elapsed_seconds), prompt_tokens: num(w.prompt_tokens),
      })),
      prefilling: ((m.prefilling as Rec[] | undefined) ?? []).map((p) => ({
        request_id: String(p.request_id), processed: num(p.processed), total: num(p.total),
        speed: num(p.speed), eta: numOrNull(p.eta), elapsed: num(p.elapsed),
        phase: String(p.phase ?? "prefill"),
        ...(p.cached_tokens != null ? { cached_tokens: num(p.cached_tokens) } : {}),
      })),
      generating: ((m.generating as Rec[] | undefined) ?? []).map((g) => ({
        request_id: String(g.request_id), elapsed_seconds: numOrNull(g.elapsed_seconds),
        generated_tokens: num(g.generated_tokens), tokens_per_second: num(g.tokens_per_second),
        last_activity_age_seconds: numOrNull(g.last_activity_age_seconds),
        prompt_tokens: num(g.prompt_tokens), max_tokens: numOrNull(g.max_tokens),
      })),
      cache: c ? {
        block_size: num(c.block_size), indexed_blocks: num(c.indexed_blocks),
        ssd_bytes: num(c.total_size_bytes), ssd_max_bytes: num(c.max_size_bytes),
        hot_bytes: num(c.hot_cache_size_bytes), hot_max_bytes: num(c.hot_cache_max_bytes),
      } : null,
    };
  });

  const loaded = new Set(models.map((m) => m.id));
  const available = mods.status === "fulfilled"
    ? ((mods.value.models as Rec[] | undefined) ?? [])
        .filter((m) => !m.loaded && !loaded.has(String(m.id)) && !m.is_hidden)
        .map((m) => ({ id: String(m.id), size_bytes: num(m.estimated_size) }))
    : [];
  const mp = (am.memory_pressure ?? {}) as Rec;
  const omlx: OmlxStatus = {
    models,
    memory_used_bytes: num(am.model_memory_used),
    memory_max_bytes: num(am.model_memory_max),
    memory_soft_bytes: numOrNull(mp.soft_bytes),
    memory_hard_bytes: numOrNull(mp.hard_bytes),
    pressure: String(mp.pressure_level ?? "?"),
    total_active: num(am.total_active_requests),
    total_waiting: num(am.total_waiting_requests),
    session: omlxTotals(session),
    alltime: all.status === "fulfilled" ? omlxTotals(all.value) : null,
    available,
  };
  return { config, online, omlx };
}

/* ------------------------------ Splash ------------------------------ */

function splashBatch(b: unknown): SplashBatch | null {
  const x = b as Rec | null | undefined;
  if (!x || !x.valid || !num(x.width)) return null;
  return {
    width: num(x.width), input_tokens: num(x.input_tokens), output_tokens: num(x.output_tokens),
    tokens_per_second: num(x.tokens_per_second), wall_ms: num(x.wall_ms),
  };
}

export async function fetchSplashStatus(config: ServerConfig): Promise<ServerStatus> {
  const base = `http://localhost:${config.port}`;
  const [health, status] = await Promise.allSettled([
    fetchWithTimeout(`${base}/health`).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); }),
    fetchWithTimeout(`${base}/status`, FETCH_TIMEOUT, authHeaders(config)).then((r) => {
      if (r.status === 401) throw new Error("API key rejected (SPLASH_API_KEY)");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<Rec>;
    }),
  ]);
  const online = markOnline(config.port, health.status === "fulfilled");
  if (status.status !== "fulfilled") {
    return { config, online, error: status.reason instanceof Error ? status.reason.message : "status unavailable" };
  }
  const d = status.value;
  const sch = (d.scheduler ?? {}) as Rec, adm = (d.admission ?? {}) as Rec, fe = (d.frontend ?? {}) as Rec;
  const met = (d.metrics ?? {}) as Rec, req = (d.requests ?? {}) as Rec, http = (d.http ?? {}) as Rec;
  const httpReq = (http.requests ?? {}) as Rec, cache = (d.cache ?? {}) as Rec, kv = (d.kv ?? {}) as Rec;
  const plan = ((d.memory_plan ?? {}) as Rec).budget as Rec | undefined;
  const mem = (d.memory_actual ?? {}) as Rec, inst = (d.instance ?? {}) as Rec;
  const ttft = (met.ttft_ms ?? {}) as Rec, itl = (met.itl_ms ?? {}) as Rec;
  const splash: SplashStatus = {
    ready: !!d.ready,
    model: String(inst.model ?? config.modelId ?? "?"),
    started_at: numOrNull(inst.started_at),
    max_context: num(d.maximum_context_tokens),
    max_batch_width: num(plan?.maximum_batch_width),
    memory_pressure: String(d.memory_pressure ?? "?"),
    memory_current_bytes: num(mem.current_bytes),
    memory_peak_bytes: num(mem.peak_bytes),
    memory_budget_bytes: num(plan?.hard_budget_bytes),
    stages: {
      http_active: num(httpReq.active), http_capacity: num(httpReq.capacity),
      preparing: num(fe.active), preparing_waiting: num(fe.waiting),
      queued: num(sch.queued), admission_waiting: num(adm.waiting),
      waiting_memory: num(sch.waiting_resources), waiting_prefix: num(sch.waiting_prefix),
      waiting_mask: num(sch.waiting_mask), prefilling: num(sch.prefilling), decoding: num(sch.decoding),
    },
    requests: { submitted: num(req.submitted), completed: num(req.completed), cancelled: num(req.cancelled), failed: num(req.failed) },
    prefill_input_tokens: num(met.prefill_input_tokens), prefill_wall_ms: num(met.prefill_wall_ms),
    decode_output_tokens: num(met.decode_output_tokens), decode_wall_ms: num(met.decode_wall_ms),
    ttft_p50_ms: numOrNull(ttft.p50), ttft_p95_ms: numOrNull(ttft.p95),
    itl_p50_ms: numOrNull(itl.p50), itl_p95_ms: numOrNull(itl.p95),
    draft_acceptance: numOrNull(met.draft_acceptance_rate),
    drafted_tokens: num(met.drafted_tokens), accepted_draft_tokens: num(met.accepted_draft_tokens),
    capacity_failures: num(met.capacity_failures), metal_failures: num(met.metal_failures),
    current_prefill: num(sch.prefilling) ? splashBatch(met.current_prefill_batch) : null,
    current_decode: num(sch.decoding) ? splashBatch(met.current_decode_batch) : null,
    active_requests: Array.isArray(d.active_requests)
      ? (d.active_requests as Rec[]).map((r) => ({
          id: num(r.id), phase: String(r.phase ?? "?"),
          priority: typeof r.priority === "string" ? r.priority : null,
          prompt_tokens: num(r.prompt_tokens), prompt_processed: num(r.prompt_processed),
          generated_tokens: num(r.generated_tokens), max_new_tokens: num(r.max_new_tokens), age_ms: num(r.age_ms),
        }))
      : null,
    decode_width: Object.fromEntries(Object.entries((sch.decode_batches_by_width ?? {}) as Rec).map(([k, v]) => [k, num(v)])),
    cache: {
      lookups: num(cache.lookups), hits: num(cache.hits), hit_rate: num(cache.hit_rate),
      reused_tokens: num(cache.reused_tokens), cold_misses: num(cache.cold_misses),
    },
    kv: { pages_total: num(kv.pages_total), pages_active: num(kv.pages_active), pages_cache: num(kv.pages_cache), cache_bytes: num(kv.cache_bytes) },
    transport_restarts: num(((d.transport ?? {}) as Rec).restarts),
  };
  return { config, online, splash };
}

export async function fetchServerStatus(config: ServerConfig): Promise<ServerStatus> {
  switch (config.framework) {
    case "llama.cpp": return fetchLlamaCppStatus(config);
    case "omlx": return fetchOmlxStatus(config);
    case "splash": return fetchSplashStatus(config);
    default: return fetchVllmMlxStatus(config);
  }
}
