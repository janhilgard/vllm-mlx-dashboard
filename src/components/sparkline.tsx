"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { TimeSeriesPoint } from "@/types";

interface SparklineProps {
  data: TimeSeriesPoint[];
  dataKey: string;
  color: string;
  label?: string;
}

export function Sparkline({ data, dataKey, color, label }: SparklineProps) {
  const recent = data.slice(-30);

  if (recent.length < 2) return null;

  return (
    <div className="space-y-1">
      {label && (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}
      <ResponsiveContainer width="100%" height={90}>
        <LineChart data={recent}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "hsl(0 0% 45%)" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(0 0% 30%)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(0 0% 45%)" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(0 0% 30%)" }}
            width={35}
            tickCount={3}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
