"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";
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
      <ResponsiveContainer width="100%" height={40}>
        <LineChart data={recent}>
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
