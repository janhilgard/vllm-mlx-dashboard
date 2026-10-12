import { NextResponse } from "next/server";
import { readSamples } from "@/lib/sampler";
import type { LoadSample, ThermalEpisode, ThermalHistoryResponse } from "@/types";

export const dynamic = "force-dynamic";

const RANGES: Record<string, number> = { "1h": 3_600_000, "6h": 6 * 3_600_000, "24h": 86_400_000, "7d": 7 * 86_400_000 };
const MAX_POINTS = 360;
/** A pause in the samples longer than this ends an episode (sampler down, app restarted). */
const EPISODE_GAP_MS = 60_000;
const SAMPLE_MS = 10_000;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const max = (xs: number[]) => (xs.length ? Math.max(...xs) : null);
const min = (xs: number[]) => (xs.length ? Math.min(...xs) : null);
const r1 = (x: number | null) => (x == null ? null : Math.round(x * 10) / 10);
const r0 = (x: number | null) => (x == null ? null : Math.round(x));
const nn = (xs: Array<number | null | undefined>) => xs.filter((x): x is number => x != null && isFinite(x));

/**
 * Thermal history: temperatures, fans, GPU clocks and thermal pressure from the
 * sampler's `th` readings, bucketed like /api/history, plus the episodes under
 * pressure (moderate or worse) with what ran during them.
 */
export async function GET(req: Request) {
  const range = new URL(req.url).searchParams.get("range") ?? "24h";
  const span = RANGES[range] ?? RANGES["24h"];   // only known ranges — nothing from the query reaches the fs
  const to = Date.now(), from = to - span;
  const samples = (await readSamples(from)).filter((s) => s.th);
  const bucketMs = Math.max(SAMPLE_MS, Math.ceil(span / MAX_POINTS / SAMPLE_MS) * SAMPLE_MS);
  const buckets = new Map<number, LoadSample[]>();
  for (const s of samples) {
    const k = Math.floor(s.t / bucketMs) * bucketMs;
    (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(s);
  }
  const fmt = new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit",
    ...(span > 86_400_000 ? { day: "numeric", month: "numeric" } : {}),
  });
  const points: ThermalHistoryResponse["points"] = [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([t, ss]) => {
    const th = ss.map((s) => s.th!);
    return {
      t, label: fmt.format(new Date(t)),
      // The worst level in the bucket, so a short episode stays visible at 7 days.
      p: max(nn(th.map((x) => x.p))),
      die: r1(avg(nn(th.map((x) => x.die)))), die_peak: r1(max(nn(th.map((x) => x.die)))),
      tg: r1(avg(nn(th.map((x) => x.fam?.Tg)))), tp: r1(avg(nn(th.map((x) => x.fam?.Tp)))),
      fan: r0(avg(nn(th.map((x) => x.fan)))),
      mhz: r0(avg(nn(th.map((x) => x.mhz)))), mhz_min: r0(min(nn(th.map((x) => x.mhz)))),
      mhz_req: r0(avg(nn(th.map((x) => x.mhz_req)))),
      gpu: r1(avg(nn(ss.map((s) => s.gpu)))), gpu_w: r1(avg(nn(ss.map((s) => s.gpu_w)))),
      cpu_w: r1(avg(nn(th.map((x) => x.cpu_w)))), ane_w: r1(avg(nn(th.map((x) => x.ane_w)))),
    };
  });

  const pressureShare = [0, 0, 0, 0, 0];
  for (const s of samples) if (s.th!.p != null) pressureShare[Math.min(4, Math.max(0, s.th!.p))] += 1;
  const counted = pressureShare.reduce((a, b) => a + b, 0);

  const last = samples[samples.length - 1];
  const res: ThermalHistoryResponse = {
    points, bucket_s: bucketMs / 1000, samples: samples.length,
    episodes: episodes(samples).reverse().slice(0, 50),
    pressure_share: pressureShare.map((n) => (counted ? Math.round((n / counted) * 1000) / 10 : 0)),
    current: last ? { ...last.th!, t: last.t, gpu: last.gpu, gpu_w: last.gpu_w } : null,
    from, to,
  };
  return NextResponse.json(res);
}

/** Runs of samples at pressure 1 or more; a nominal sample or a gap ends one. */
function episodes(samples: LoadSample[]): ThermalEpisode[] {
  const out: ThermalEpisode[] = [];
  let run: LoadSample[] = [];
  const close = () => {
    if (!run.length) return;
    const th = run.map((s) => s.th!);
    const busy = run.filter((s) => s.th!.mhz != null);
    const ratios = nn(busy.map((s) => (s.th!.mhz_req ? s.th!.mhz! / s.th!.mhz_req : null)));
    const tps = new Map<string, number[]>();
    for (const s of run)
      for (const [id, e] of Object.entries(s.engines)) {
        const v = (e.prompt_tps ?? 0) + (e.gen_tps ?? 0);
        (tps.get(id) ?? tps.set(id, []).get(id)!).push(v);
      }
    out.push({
      from: run[0].t,
      to: run[run.length - 1].t + SAMPLE_MS,
      peak: max(nn(th.map((x) => x.p))) ?? 1,
      die_max: r1(max(nn(th.map((x) => x.die)))),
      tg_max: r1(max(nn(th.map((x) => x.fam?.Tg)))),
      fan_max: r0(max(nn(th.map((x) => x.fan)))),
      mhz_min: r0(min(nn(busy.map((s) => s.th!.mhz)))),
      clock_ratio: ratios.length ? Math.round((avg(ratios) ?? 0) * 100) / 100 : null,
      gpu_avg: r1(avg(nn(run.map((s) => s.gpu)))),
      engines: [...tps.entries()]
        .map(([id, vs]) => ({ id, tps: Math.round(vs.reduce((a, b) => a + b, 0) / vs.length) }))
        .filter((e) => e.tps > 0)
        .sort((a, b) => b.tps - a.tps),
    });
    run = [];
  };
  for (const s of samples) {
    const p = s.th!.p;
    if (run.length && s.t - run[run.length - 1].t > EPISODE_GAP_MS) close();
    if (p != null && p >= 1) run.push(s);
    else close();
  }
  close();
  return out;
}
