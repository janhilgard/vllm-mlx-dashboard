"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { TimeSeriesPoint } from "@/types";

export interface Series {
  key: string;
  name: string;
  color: string;
}

/** Small multi-series line chart over the shared dashboard time series. */
export function MultiChart({ data, series, title, height = 110, average = false }: {
  data: TimeSeriesPoint[];
  series: Series[];
  title: string;
  height?: number;
  /** Show the mean of each series over the visible window (incl. idle). */
  average?: boolean;
}) {
  const recent = data.slice(-60);
  if (recent.length < 2) return null;
  const mean = (key: string) => {
    const v = recent.map((p) => Number((p as unknown as Record<string, unknown>)[key])).filter((x) => Number.isFinite(x));
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  };
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">
        {title}
        {average && series.map((s) => (
          <span key={s.key} className="ml-2" style={{ color: s.color }}>ø {mean(s.key).toFixed(0)}</span>
        ))}
      </span>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={recent}>
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(0 0% 45%)" }} tickLine={false}
                 axisLine={{ stroke: "hsl(0 0% 30%)" }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: "hsl(0 0% 45%)" }} tickLine={false}
                 axisLine={{ stroke: "hsl(0 0% 30%)" }} width={42} tickCount={3} />
          <Tooltip contentStyle={{ backgroundColor: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 6, fontSize: 11 }}
                   labelStyle={{ color: "hsl(0 0% 70%)" }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color}
                  strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
