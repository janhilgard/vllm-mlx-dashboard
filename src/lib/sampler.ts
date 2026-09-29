import { exec } from "child_process";
import { mkdir, appendFile, readFile, readdir, unlink } from "fs/promises";
import path from "path";
import { SERVERS } from "@/lib/server-config";
import { fetchServerStatus } from "@/lib/fetchers";
import { counters } from "@/lib/counters";
import { getGpuMetrics, getSystemMetrics } from "@/lib/gpu-metrics";
import type { LoadSample } from "@/types";

/**
 * SERVER-SIDE LOAD HISTORY. The charts in the browser only cover the time the
 * page has been open; "how busy is the server over the day" needs a sampler
 * that runs whether anyone looks or not. Started once from `instrumentation.ts`.
 *
 * Every SAMPLE_MS: CPU (iostat, 1 s window), GPU utilisation and power
 * (powermetrics), memory and swap, load average, and per engine the running /
 * waiting requests and tok/s (delta of cumulative counters since the previous
 * sample). Stored as one NDJSON file per UTC day under `data/`, kept KEEP_DAYS.
 */
const SAMPLE_MS = 10_000;
const KEEP_DAYS = 14;
export const DATA_DIR = path.join(process.cwd(), "data");

type State = { timer?: ReturnType<typeof setInterval>; prev?: { t: number; c: Record<string, { gen: number; prompt: number }> }; busy?: boolean };
const g = globalThis as unknown as { __loadSampler?: State };

function sh(cmd: string, timeout = 5000): Promise<string> {
  return new Promise((resolve) => exec(cmd, { timeout }, (err, out) => resolve(err ? "" : out)));
}

async function cpuPercent(): Promise<number | null> {
  // Second line = the last 1 s; the first one is the average since boot.
  const out = (await sh("iostat -n 0 -c 2 -w 1")).trim().split("\n");
  const cols = out[out.length - 1]?.trim().split(/\s+/).map(Number);
  return cols && cols.length >= 3 && isFinite(cols[2]) ? 100 - cols[2] : null;
}

const fileFor = (t: number) => path.join(DATA_DIR, `load-${new Date(t).toISOString().slice(0, 10)}.ndjson`);

async function sampleOnce(state: State): Promise<void> {
  if (state.busy) return;   // never overlap if a sample runs long
  state.busy = true;
  try {
    const t = Date.now();
    const [cpu, gpu, sys, servers] = await Promise.all([
      cpuPercent(), getGpuMetrics(), getSystemMetrics(), Promise.all(SERVERS.map(fetchServerStatus)),
    ]);
    const engines: LoadSample["engines"] = {};
    const cur: Record<string, { gen: number; prompt: number }> = {};
    for (const s of servers) {
      const c = s.online ? counters(s) : null;
      if (!c) continue;
      cur[s.config.id] = { gen: c.gen, prompt: c.prompt };
      const p = state.prev?.c[s.config.id];
      const dt = state.prev ? (t - state.prev.t) / 1000 : 0;
      const rate = (a: number, b?: number) => (b != null && dt > 0 && a >= b ? Math.round(((a - b) / dt) * 10) / 10 : null);
      engines[s.config.id] = { running: c.running, waiting: c.waiting, gen_tps: rate(c.gen, p?.gen), prompt_tps: rate(c.prompt, p?.prompt) };
    }
    state.prev = { t, c: cur };
    const sample: LoadSample = {
      t,
      cpu,
      gpu: gpu.gpu_utilization_percent,
      gpu_w: gpu.gpu_power_watts,
      mem_used: sys?.memory_used_bytes ?? null,
      mem_total: sys?.memory_total_bytes ?? null,
      swap_used: sys?.swap_used_bytes ?? null,
      load1: sys?.load[0] ?? null,
      engines,
    };
    await mkdir(DATA_DIR, { recursive: true });
    await appendFile(fileFor(t), JSON.stringify(sample) + "\n");
  } catch {
    // A failed sample leaves a gap in the chart; it must never take the app down.
  } finally {
    state.busy = false;
  }
}

async function prune(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
    for (const f of await readdir(DATA_DIR)) {
      const m = f.match(/^load-(\d{4}-\d{2}-\d{2})\.ndjson$/);
      if (m && m[1] < cutoff) await unlink(path.join(DATA_DIR, f));
    }
  } catch { /* nothing to prune yet */ }
}

export function startSampler(): void {
  const state = (g.__loadSampler ??= {});
  if (state.timer) return;
  void sampleOnce(state);
  state.timer = setInterval(() => void sampleOnce(state), SAMPLE_MS);
  void prune();
  setInterval(() => void prune(), 6 * 3_600_000);
}

/** Samples from `fromMs` to now, read from the day files that cover the range. */
export async function readSamples(fromMs: number): Promise<LoadSample[]> {
  const out: LoadSample[] = [];
  for (let d = new Date(new Date(fromMs).toISOString().slice(0, 10)).getTime(); d <= Date.now(); d += 86_400_000) {
    let text = "";
    try { text = await readFile(fileFor(d), "utf8"); } catch { continue; }
    for (const line of text.split("\n")) {
      if (!line) continue;
      try {
        const s = JSON.parse(line) as LoadSample;
        if (s.t >= fromMs) out.push(s);
      } catch { /* torn last line */ }
    }
  }
  return out;
}
