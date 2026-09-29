"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GpuMetrics, SystemMetrics } from "@/types";
import { MetricValue } from "./metric-value";
import { Bar, Section, fmtBytes } from "./engine-ui";

/** The machine under all engines: unified memory, swap, CPU load, GPU, processes. */
export function SystemCard({ system, gpu }: { system?: SystemMetrics; gpu?: GpuMetrics }) {
  if (!system) return null;
  const s = system;
  const used = s.memory_total_bytes ? (s.memory_used_bytes / s.memory_total_bytes) * 100 : 0;
  return (
    <Card className="md:col-span-2 lg:col-span-3">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">AI server · studio</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <Section title="Unified memory">
              <Bar value={used} color={used < 85 ? "bg-blue-500" : used < 95 ? "bg-amber-500" : "bg-red-500"}
                   label={`${fmtBytes(s.memory_used_bytes)} / ${fmtBytes(s.memory_total_bytes)}`} />
              <div className="grid grid-cols-4 gap-3">
                <MetricValue label="Wired" value={fmtBytes(s.memory_wired_bytes)} />
                <MetricValue label="Compressed" value={fmtBytes(s.memory_compressed_bytes)} />
                <MetricValue label="File cache" value={fmtBytes(s.memory_cached_bytes)} />
                <MetricValue label="Swap" value={`${fmtBytes(s.swap_used_bytes)} / ${fmtBytes(s.swap_total_bytes)}`} />
              </div>
            </Section>
            <div className="grid grid-cols-4 gap-3">
              <MetricValue label={`Load (${s.cpu_count} cores)`} value={s.load.map((l) => l.toFixed(2)).join(" · ")} />
              <MetricValue label="GPU" value={gpu?.gpu_utilization_percent != null ? `${gpu.gpu_utilization_percent.toFixed(0)}` : "N/A"} suffix={gpu?.gpu_utilization_percent != null ? "%" : undefined} />
              <MetricValue label="GPU power" value={gpu?.gpu_power_watts != null ? `${gpu.gpu_power_watts.toFixed(0)}` : "N/A"} suffix={gpu?.gpu_power_watts != null ? "W" : undefined} />
            </div>
          </div>
          <Section title="Engine processes">
            {s.processes.length === 0 ? (
              <p className="text-xs text-muted-foreground">none found</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="text-left">
                    <th className="font-normal py-1">process</th>
                    <th className="font-normal">pid</th>
                    <th className="font-normal text-right">CPU</th>
                    <th className="font-normal text-right">RSS</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {s.processes.map((p) => (
                    <tr key={p.pid} className="border-t border-border/50">
                      <td className="py-1 font-sans">{p.name}</td>
                      <td className="text-muted-foreground">{p.pid}</td>
                      <td className="text-right">{p.cpu_percent.toFixed(1)}%</td>
                      <td className="text-right">{fmtBytes(p.rss_bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="text-[10px] text-muted-foreground">RSS excludes GPU-wired model memory, which sits under “Wired”.</p>
          </Section>
        </div>
      </CardContent>
    </Card>
  );
}
