"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimeSeriesPoint } from "@/types";
import { ServerConfig } from "@/types";

interface ThroughputChartProps {
  data: TimeSeriesPoint[];
  servers: ServerConfig[];
}

export function ThroughputChart({ data, servers }: ThroughputChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Throughput Over Time (tok/s)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
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
                tick={{ fontSize: 10, fill: "hsl(0 0% 45%)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}`}
                width={40}
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
              <Legend
                wrapperStyle={{ fontSize: 11 }}
              />
              {servers.map((server) => (
                  <Line
                    key={server.id}
                    type="monotone"
                    dataKey={server.id}
                    stroke={server.color}
                    strokeWidth={2}
                    dot={false}
                    name={server.name}
                    isAnimationActive={false}
                    connectNulls
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
