"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Area, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SERVERS } from "@/lib/server-config";
import type { ThermalEpisode, ThermalHistoryResponse } from "@/types";

const RANGES = ["1h", "6h", "24h", "7d"] as const;
type Range = (typeof RANGES)[number];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const axis = { tick: { fontSize: 10, fill: "hsl(0 0% 45%)" }, tickLine: false, axisLine: { stroke: "hsl(0 0% 30%)" } };
const tooltip = {
  contentStyle: { backgroundColor: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 6, fontSize: 11 },
  labelStyle: { color: "hsl(0 0% 70%)" },
};

/** macOS thermal pressure levels (com.apple.system.thermalpressurelevel). */
const LEVELS = [
  { name: "Nominal", color: "#22c55e" },
  { name: "Moderate", color: "#eab308" },
  { name: "Heavy", color: "#f97316" },
  { name: "Trapping", color: "#ef4444" },
  { name: "Sleeping", color: "#ef4444" },
];
const level = (p: number | null | undefined) => (p == null ? null : LEVELS[Math.min(4, Math.max(0, p))]);

const time = new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
const clock = new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit" });

function duration(ms: number): string {
  const m = Math.round(ms / 60_000);
  return m < 1 ? `${Math.round(ms / 1000)} s` : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** "Splash · Qwen3.6-35B-A3B" → "35B", "Splash · Qwen3.8-Flash-Next" → "Flash-Next". */
function engineName(id: string): string {
  const name = SERVERS.find((s) => s.id === id)?.name ?? id;
  return name.match(/\d+B/)?.[0] ?? name.match(/Flash-Next/)?.[0] ?? name;
}

/**
 * Temperatures, fans and GPU throttling over time, from the server-side
 * sampler (every 10 s). macOS lowers the GPU clock under thermal pressure:
 * the GPU then runs below the clock its driver asks for, which is what the
 * clock chart shows. The episodes list every stretch under pressure with what
 * ran during it, to see what heats the Mac and when.
 */
export function ThermalHistory() {
  const [range, setRange] = useState<Range>("24h");
  const { data } = useSWR<ThermalHistoryResponse>(`/api/thermal?range=${range}`, fetcher, {
    refreshInterval: range === "1h" ? 10_000 : 60_000,
    keepPreviousData: true,
    revalidateOnFocus: false,
  });
  const pts = data?.points ?? [];
  const now = data?.current;
  const nowLevel = level(now?.p);
  const throttledShare = data ? data.pressure_share.slice(1).reduce((a, b) => a + b, 0) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">Thermals &amp; GPU throttling</CardTitle>
          <div className="flex items-center gap-2">
            {data && (
              <span className="text-[10px] text-muted-foreground">
                {data.samples.toLocaleString()} samples · under pressure {throttledShare.toFixed(1)} % of the range
              </span>
            )}
            <div className="flex rounded-md bg-muted p-0.5">
              {RANGES.map((r) => (
                <button key={r} onClick={() => setRange(r)}
                        className={`rounded px-2 py-0.5 text-xs ${r === range ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {now && (
          <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3 lg:grid-cols-6">
            <Stat label="Thermal pressure">
              <span className="font-semibold" style={{ color: nowLevel?.color }}>{nowLevel?.name ?? "—"}</span>
            </Stat>
            <Stat label="GPU clock (asked / max)">
              {now.mhz != null ? (
                <>
                  <span className="font-semibold" style={{ color: now.mhz_req && now.mhz < now.mhz_req * 0.9 ? "#f97316" : undefined }}>
                    {now.mhz} MHz
                  </span>
                  <span className="text-muted-foreground"> ({now.mhz_req ?? "—"} / {now.mhz_max ?? "—"})</span>
                </>
              ) : <span className="text-muted-foreground">GPU idle</span>}
            </Stat>
            <Stat label="SoC die (max / mean)">
              <span className="font-semibold">{now.die ?? "—"} °C</span>
              <span className="text-muted-foreground"> / {now.die_avg ?? "—"} °C</span>
            </Stat>
            <Stat label="SMC GPU (Tg) · hottest key">
              <span className="font-semibold">{now.fam?.Tg ?? "—"} °C</span>
              {now.top && <span className="text-muted-foreground"> · {now.top[0]} {now.top[1]} °C</span>}
            </Stat>
            <Stat label="Fans (target / max)">
              <span className="font-semibold">{now.fan ?? "—"} rpm</span>
              <span className="text-muted-foreground"> ({now.fan_target ?? "—"} / {now.fan_max ?? "—"})</span>
            </Stat>
            <Stat label="Power GPU · CPU · ANE">
              <span className="font-semibold">{now.gpu_w ?? "—"} W</span>
              <span className="text-muted-foreground"> · {now.cpu_w ?? "—"} · {now.ane_w ?? "—"} W</span>
            </Stat>
          </div>
        )}

        {pts.length < 2 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Collecting samples — the charts fill in as the sampler runs (every 10 s).
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Chart title="Temperatures (°C) · fans (rpm) · shaded = thermal pressure" data={pts}>
              <YAxis yAxisId="c" domain={[30, "auto"]} {...axis} width={32} />
              <YAxis yAxisId="rpm" orientation="right" domain={[0, now?.fan_max ?? "auto"]} {...axis} width={40} />
              <YAxis yAxisId="p" hide domain={[0, 4]} />
              <Area yAxisId="p" dataKey="p" name="pressure" type="stepAfter" stroke="none" fill="#f97316" fillOpacity={0.18} isAnimationActive={false} />
              <Line yAxisId="c" dataKey="die_peak" name="die peak" stroke="#ef4444" strokeWidth={1} strokeDasharray="2 2" dot={false} isAnimationActive={false} connectNulls />
              <Line yAxisId="c" dataKey="die" name="die max" stroke="#ef4444" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
              <Line yAxisId="c" dataKey="tg" name="SMC Tg" stroke="#a855f7" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
              <Line yAxisId="c" dataKey="tp" name="SMC Tp" stroke="#3b82f6" strokeWidth={1} dot={false} isAnimationActive={false} connectNulls />
              <Line yAxisId="rpm" dataKey="fan" name="fans rpm" stroke="#06b6d4" strokeWidth={1} strokeDasharray="4 3" dot={false} isAnimationActive={false} connectNulls />
            </Chart>

            <Chart title="GPU clock (MHz): granted vs asked · GPU load (%) · shaded = thermal pressure" data={pts}>
              <YAxis yAxisId="mhz" domain={[0, now?.mhz_max ?? "auto"]} {...axis} width={40} />
              <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} {...axis} width={30} />
              <YAxis yAxisId="p" hide domain={[0, 4]} />
              <Area yAxisId="p" dataKey="p" name="pressure" type="stepAfter" stroke="none" fill="#f97316" fillOpacity={0.18} isAnimationActive={false} />
              <Line yAxisId="mhz" dataKey="mhz_req" name="asked MHz" stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 3" dot={false} isAnimationActive={false} connectNulls />
              <Line yAxisId="mhz" dataKey="mhz" name="granted MHz" stroke="#f97316" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
              <Line yAxisId="mhz" dataKey="mhz_min" name="lowest MHz" stroke="#f97316" strokeWidth={1} strokeDasharray="2 2" dot={false} isAnimationActive={false} connectNulls />
              <Line yAxisId="pct" dataKey="gpu" name="GPU %" stroke="#a855f7" strokeWidth={1} dot={false} isAnimationActive={false} connectNulls />
            </Chart>
          </div>
        )}

        {data && <Episodes episodes={data.episodes} share={data.pressure_share} />}
      </CardContent>
    </Card>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function Episodes({ episodes, share }: { episodes: ThermalEpisode[]; share: number[] }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">Episodes under thermal pressure (newest first)</span>
        <span className="text-[10px] text-muted-foreground">
          {LEVELS.slice(0, 4).map((l, i) => `${l.name} ${share[i] ?? 0} %`).join(" · ")}
        </span>
      </div>
      {episodes.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">None in this range.</p>
      ) : (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card text-[10px] text-muted-foreground">
              <tr className="text-left">
                <th className="py-1 pr-2 font-normal">When</th>
                <th className="pr-2 font-normal">How long</th>
                <th className="pr-2 font-normal">Peak</th>
                <th className="pr-2 font-normal">Die max</th>
                <th className="pr-2 font-normal">Tg max</th>
                <th className="pr-2 font-normal">Fans max</th>
                <th className="pr-2 font-normal">GPU clock</th>
                <th className="pr-2 font-normal">GPU load</th>
                <th className="font-normal">Running (tok/s)</th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((e) => {
                const l = level(e.peak);
                return (
                  <tr key={e.from} className="border-t border-border/40">
                    <td className="py-1 pr-2 whitespace-nowrap">{time.format(new Date(e.from))}–{clock.format(new Date(e.to))}</td>
                    <td className="pr-2 whitespace-nowrap">{duration(e.to - e.from)}</td>
                    <td className="pr-2" style={{ color: l?.color }}>{l?.name}</td>
                    <td className="pr-2">{e.die_max ?? "—"} °C</td>
                    <td className="pr-2">{e.tg_max ?? "—"} °C</td>
                    <td className="pr-2">{e.fan_max ?? "—"} rpm</td>
                    <td className="pr-2 whitespace-nowrap">
                      {e.clock_ratio != null ? `${Math.round(e.clock_ratio * 100)} % of asked` : "—"}
                      {e.mhz_min != null && <span className="text-muted-foreground"> · min {e.mhz_min} MHz</span>}
                    </td>
                    <td className="pr-2">{e.gpu_avg ?? "—"} %</td>
                    <td>{e.engines.length ? e.engines.map((x) => `${engineName(x.id)} ${x.tps}`).join(", ") : "idle"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Chart({ title, data, children }: { title: string; data: ThermalHistoryResponse["points"]; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{title}</span>
      <ResponsiveContainer width="100%" height={190}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" vertical={false} />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={40} />
          <Tooltip {...tooltip} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {children}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
