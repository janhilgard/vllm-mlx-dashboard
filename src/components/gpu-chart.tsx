"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimeSeriesPoint } from "@/types";

interface GpuChartProps {
  data: TimeSeriesPoint[];
}

export function GpuChart({ data }: GpuChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">GPU Load Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <defs>
                <linearGradient id="gpuGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(0 0% 20%)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "hsl(0 0% 45%)" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="left"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "hsl(0 0% 45%)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
                width={40}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: "hsl(0 0% 45%)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}W`}
                width={40}
              />
              <Legend
                verticalAlign="top"
                height={28}
                wrapperStyle={{ fontSize: 12, color: "hsl(0 0% 60%)" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(0 0% 12%)",
                  border: "1px solid hsl(0 0% 20%)",
                  borderRadius: "6px",
                  fontSize: 12,
                }}
                labelStyle={{ color: "hsl(0 0% 70%)" }}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="gpuUtilization"
                stroke="#8b5cf6"
                fill="url(#gpuGradient)"
                strokeWidth={2}
                name="GPU %"
                isAnimationActive={false}
                connectNulls
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="gpuPower"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
                name="GPU W"
                isAnimationActive={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
