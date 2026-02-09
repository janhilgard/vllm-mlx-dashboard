"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ServerStatus, TimeSeriesPoint } from "@/types";
import type { ServerThroughput } from "@/hooks/use-realtime-throughput";
import { StatusBadge } from "./status-badge";
import { MetricValue } from "./metric-value";
import { SlotIndicator } from "./slot-indicator";
import { Sparkline } from "./sparkline";

interface ServerCardProps {
  server: ServerStatus;
  throughput?: ServerThroughput;
  history?: TimeSeriesPoint[];
}

export function ServerCard({ server, throughput, history }: ServerCardProps) {
  const { config, online, metrics, slots, vllm } = server;
  const isProcessing = metrics?.requests_processing
    ? metrics.requests_processing > 0
    : vllm?.num_running
      ? vllm.num_running > 0
      : false;

  return (
    <Card className="relative overflow-hidden">
      <div
        className="absolute top-0 left-0 w-1 h-full"
        style={{ backgroundColor: config.color }}
      />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{config.name}</CardTitle>
          <StatusBadge online={online} processing={isProcessing} />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            :{config.port}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {config.framework}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {config.framework === "llama.cpp" && online && metrics ? (
          <LlamaCppDetails metrics={metrics} slots={slots ?? []} throughput={throughput} history={history} serverId={config.id} color={config.color} />
        ) : config.framework === "vllm-mlx" && online && vllm ? (
          <VllmMlxDetails vllm={vllm} history={history} serverId={config.id} color={config.color} />
        ) : !online ? (
          <p className="text-xs text-muted-foreground">Server unavailable</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function LlamaCppDetails({
  metrics,
  slots,
  throughput,
  history,
  serverId,
  color,
}: {
  metrics: NonNullable<ServerStatus["metrics"]>;
  slots: NonNullable<ServerStatus["slots"]>;
  throughput?: ServerThroughput;
  history?: TimeSeriesPoint[];
  serverId: string;
  color: string;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <MetricValue
          label="Generation"
          value={throughput?.generation ?? 0}
          suffix="tok/s"
        />
        <MetricValue
          label="Prompt"
          value={throughput?.prompt ?? 0}
          suffix="tok/s"
        />
        <MetricValue
          label="Active Req."
          value={metrics.requests_processing.toString()}
        />
        <MetricValue
          label="Deferred Req."
          value={metrics.requests_deferred.toString()}
          highlight={metrics.requests_deferred > 0}
        />
        <MetricValue
          label="Tokens Gen."
          value={metrics.tokens_predicted_total}
        />
        <MetricValue
          label="Prompt Tokens"
          value={metrics.prompt_tokens_total}
        />
      </div>
      {history && history.length > 1 && (
        <div className="space-y-2">
          <Sparkline data={history} dataKey={serverId} color={color} label="tok/s" />
          <Sparkline data={history} dataKey={`${serverId}_requests`} color={`${color}80`} label="Requests" />
        </div>
      )}
      {slots.length > 0 && <SlotIndicator slots={slots} />}
    </div>
  );
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function VllmMlxDetails({ vllm, history, serverId, color }: { vllm: NonNullable<ServerStatus["vllm"]>; history?: TimeSeriesPoint[]; serverId: string; color: string }) {
  const hasFullStatus = vllm.uptime_s != null;

  if (!hasFullStatus) {
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Status</span>
          <span className="font-mono">{vllm.status}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <MetricValue label="Uptime" value={formatUptime(vllm.uptime_s)} />
        <MetricValue
          label="Requests"
          value={vllm.total_requests_processed.toString()}
        />
        <MetricValue
          label="Running"
          value={vllm.num_running.toString()}
          highlight={vllm.num_running > 0}
        />
        <MetricValue
          label="Waiting"
          value={vllm.num_waiting.toString()}
          highlight={vllm.num_waiting > 0}
        />
        <MetricValue label="Completion Tok." value={vllm.total_completion_tokens} />
        <MetricValue label="Prompt Tok." value={vllm.total_prompt_tokens} />
      </div>

      {history && history.length > 1 && (
        <div className="space-y-2">
          <Sparkline data={history} dataKey={serverId} color={color} label="tok/s" />
          <Sparkline data={history} dataKey={`${serverId}_requests`} color={`${color}80`} label="Requests" />
        </div>
      )}

      {vllm.metal && (
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground font-medium">Metal Memory</span>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{
                  width: `${vllm.metal.peak_memory_gb ? Math.min((vllm.metal.active_memory_gb / vllm.metal.peak_memory_gb) * 100, 100) : 0}%`,
                }}
              />
            </div>
            <span className="text-xs font-mono whitespace-nowrap">
              {(vllm.metal.active_memory_gb ?? 0).toFixed(1)} / {(vllm.metal.peak_memory_gb ?? 0).toFixed(1)} GB
            </span>
          </div>
        </div>
      )}

      {vllm.cache && (
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground font-medium">KV Cache</span>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500"
                style={{
                  width: `${Math.min((vllm.cache.memory_utilization ?? 0) * 100, 100)}%`,
                }}
              />
            </div>
            <span className="text-xs font-mono whitespace-nowrap">
              {((vllm.cache.memory_utilization ?? 0) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Hit rate</span>
              <span className="font-mono ml-1">{((vllm.cache.hit_rate ?? 0) * 100).toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-muted-foreground">Saved</span>
              <span className="font-mono ml-1">{vllm.cache.tokens_saved.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Evict.</span>
              <span className="font-mono ml-1">{vllm.cache.evictions}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
