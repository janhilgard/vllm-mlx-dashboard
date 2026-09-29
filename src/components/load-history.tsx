"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Area, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SERVERS } from "@/lib/server-config";
import type { LoadHistoryResponse, LoadPoint } from "@/types";

const RANGES = ["1h", "6h", "24h", "7d"] as const;
type Range = (typeof RANGES)[number];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const axis = { tick: { fontSize: 10, fill: "hsl(0 0% 45%)" }, tickLine: false, axisLine: { stroke: "hsl(0 0% 30%)" } };
const tooltip = {
  contentStyle: { backgroundColor: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 6, fontSize: 11 },
  labelStyle: { color: "hsl(0 0% 70%)" },
};

/**
 * Server load over time, from the server-side sampler (every 10 s, kept
 * 14 days) — unlike the live charts it does not depend on the page being
 * open. Each point is a bucket: the line is the average, the faint band the
 * peak, so a short spike does not vanish in the mean.
 */
export function LoadHistory() {
  const [range, setRange] = useState<Range>("6h");
  const { data } = useSWR<LoadHistoryResponse>(`/api/history?range=${range}`, fetcher, {
    refreshInterval: range === "1h" ? 10_000 : 60_000,
    keepPreviousData: true,
    revalidateOnFocus: false,
  });
  const pts: LoadPoint[] = data?.points ?? [];
  // Only engines that did something in this range: an idle fallback (oMLX)
  // would draw two flat zero lines and two legend entries for nothing.
  const aktivni = SERVERS.filter((s) =>
    pts.some((p) => Number(p[`${s.id}_prompt` as keyof LoadPoint]) > 0 || Number(p[`${s.id}_gen` as keyof LoadPoint]) > 0));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">Server load over time</CardTitle>
          <div className="flex items-center gap-2">
            {data && (
              <span className="text-[10px] text-muted-foreground">
                {data.samples.toLocaleString()} samples · {data.bucket_s >= 60 ? `${data.bucket_s / 60} min` : `${data.bucket_s} s`} per point · line = average, band = peak
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
      <CardContent>
        {pts.length < 2 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Collecting samples — the chart fills in as the sampler runs (every 10 s).
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Chart title="CPU & GPU (%) · GPU power (W)" data={pts}>
              <YAxis yAxisId="pct" domain={[0, 100]} {...axis} width={32} />
              <YAxis yAxisId="w" orientation="right" {...axis} width={36} />
              <Area yAxisId="pct" dataKey="gpu_max" name="GPU peak" stroke="none" fill="#a855f7" fillOpacity={0.12} isAnimationActive={false} />
              <Area yAxisId="pct" dataKey="cpu_max" name="CPU peak" stroke="none" fill="#3b82f6" fillOpacity={0.12} isAnimationActive={false} />
              <Line yAxisId="pct" dataKey="gpu" name="GPU %" stroke="#a855f7" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
              <Line yAxisId="pct" dataKey="cpu" name="CPU %" stroke="#3b82f6" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
              <Line yAxisId="w" dataKey="gpu_w" name="GPU W" stroke="#f97316" strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} connectNulls />
            </Chart>

            <Chart title={`Memory (GB${data?.mem_total_gb ? ` of ${data.mem_total_gb}` : ""}) · swap · load`} data={pts}>
              <YAxis yAxisId="gb" domain={[0, data?.mem_total_gb ?? "auto"]} {...axis} width={36} />
              <YAxis yAxisId="load" orientation="right" {...axis} width={30} />
              <Area yAxisId="gb" dataKey="mem_gb" name="used GB" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} strokeWidth={1.5} isAnimationActive={false} connectNulls />
              <Line yAxisId="gb" dataKey="swap_gb" name="swap GB" stroke="#ef4444" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
              <Line yAxisId="load" dataKey="load1" name="load 1m" stroke="#eab308" strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} connectNulls />
            </Chart>

            <Chart title="AI requests · running and waiting (all engines)" data={pts}>
              <YAxis {...axis} width={32} allowDecimals={false} />
              <Area dataKey="waiting_max" name="waiting peak" stroke="none" fill="#ef4444" fillOpacity={0.12} isAnimationActive={false} />
              <Area dataKey="running_max" name="running peak" stroke="none" fill="#22c55e" fillOpacity={0.12} isAnimationActive={false} />
              <Line dataKey="running" name="running" stroke="#22c55e" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
              <Line dataKey="waiting" name="waiting" stroke="#ef4444" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
            </Chart>

            <Chart title="Tokens per second by engine (prompt solid / generation dashed)" data={pts}>
              <YAxis {...axis} width={42} />
              {aktivni.map((s) => (
                <Line key={`${s.id}_prompt`} dataKey={`${s.id}_prompt`} name={`${kratce(s.name)} prompt`} stroke={s.color}
                      strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
              ))}
              {aktivni.map((s) => (
                <Line key={`${s.id}_gen`} dataKey={`${s.id}_gen`} name={`${kratce(s.name)} gen`} stroke={s.color}
                      strokeWidth={1} strokeDasharray="4 3" dot={false} isAnimationActive={false} connectNulls />
              ))}
            </Chart>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** "Splash · Qwen3.6-35B-A3B" → "Splash 35B": both Splash instances used to
 *  show up in the legend as just "Splash". */
function kratce(name: string): string {
  const m = name.match(/^(\S+).*?(\d+B)/);
  return m ? `${m[1]} ${m[2]}` : name.split(" ")[0];
}

function Chart({ title, data, children }: { title: string; data: LoadPoint[]; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{title}</span>
      <ResponsiveContainer width="100%" height={170}>
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
