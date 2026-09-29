import { NextResponse } from "next/server";
import { readSamples } from "@/lib/sampler";
import { SERVERS } from "@/lib/server-config";
import type { LoadHistoryResponse, LoadPoint, LoadSample } from "@/types";

export const dynamic = "force-dynamic";

const RANGES: Record<string, number> = { "1h": 3_600_000, "6h": 6 * 3_600_000, "24h": 86_400_000, "7d": 7 * 86_400_000 };
const MAX_POINTS = 360;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const max = (xs: number[]) => (xs.length ? Math.max(...xs) : null);
const r1 = (x: number | null) => (x == null ? null : Math.round(x * 10) / 10);
const nn = (xs: Array<number | null | undefined>) => xs.filter((x): x is number => x != null && isFinite(x));

export async function GET(req: Request) {
  const range = new URL(req.url).searchParams.get("range") ?? "6h";
  const span = RANGES[range] ?? RANGES["6h"];   // only known ranges — nothing from the query reaches the fs
  const to = Date.now(), from = to - span;
  const samples = await readSamples(from);
  const bucketMs = Math.max(10_000, Math.ceil(span / MAX_POINTS / 10_000) * 10_000);
  const buckets = new Map<number, LoadSample[]>();
  for (const s of samples) {
    const k = Math.floor(s.t / bucketMs) * bucketMs;
    (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(s);
  }
  const engineIds = SERVERS.map((s) => s.id);
  const fmt = new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit",
    ...(span > 86_400_000 ? { day: "numeric", month: "numeric" } : {}),
  });
  const points: LoadPoint[] = [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([t, ss]) => {
    const per = (id: string, k: "running" | "waiting" | "gen_tps" | "prompt_tps") => nn(ss.map((s) => s.engines[id]?.[k]));
    // Totals across engines per sample, then averaged over the bucket.
    const tot = (k: "running" | "waiting" | "gen_tps" | "prompt_tps") =>
      nn(ss.map((s) => { const v = nn(Object.values(s.engines).map((e) => e[k])); return v.length ? v.reduce((a, b) => a + b, 0) : null; }));
    const p: LoadPoint = {
      t, label: fmt.format(new Date(t)),
      cpu: r1(avg(nn(ss.map((s) => s.cpu)))), cpu_max: r1(max(nn(ss.map((s) => s.cpu)))),
      gpu: r1(avg(nn(ss.map((s) => s.gpu)))), gpu_max: r1(max(nn(ss.map((s) => s.gpu)))),
      gpu_w: r1(avg(nn(ss.map((s) => s.gpu_w)))),
      mem_gb: r1((avg(nn(ss.map((s) => s.mem_used))) ?? NaN) / 1024 ** 3) ,
      swap_gb: r1((max(nn(ss.map((s) => s.swap_used))) ?? NaN) / 1024 ** 3),
      load1: r1(avg(nn(ss.map((s) => s.load1)))),
      running: r1(avg(tot("running"))), running_max: max(tot("running")),
      waiting: r1(avg(tot("waiting"))), waiting_max: max(tot("waiting")),
      gen_tps: r1(avg(tot("gen_tps"))), prompt_tps: r1(avg(tot("prompt_tps"))),
    };
    for (const id of engineIds) {
      p[`${id}_gen`] = r1(avg(per(id, "gen_tps")));
      p[`${id}_prompt`] = r1(avg(per(id, "prompt_tps")));
      p[`${id}_waiting`] = r1(avg(per(id, "waiting")));
    }
    for (const k of ["mem_gb", "swap_gb"] as const) if (Number.isNaN(p[k] as number)) p[k] = null;
    return p;
  });
  const memTotal = samples.length ? samples[samples.length - 1].mem_total : null;
  const res: LoadHistoryResponse = {
    points, bucket_s: bucketMs / 1000, samples: samples.length,
    mem_total_gb: memTotal ? Math.round(memTotal / 1024 ** 3) : null,
    engines: engineIds, from, to,
  };
  return NextResponse.json(res);
}
