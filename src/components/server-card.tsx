"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ServerStatus, TimeSeriesPoint, VllmRequest } from "@/types";
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
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-sm font-medium">{config.name}</CardTitle>
            {config.modelId && <CopyButton text={config.modelId} title="Copy model ID" />}
          </div>
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
        <CopyableEndpoint port={config.port} />
      </CardHeader>
      <CardContent>
        {config.framework === "llama.cpp" && online && metrics ? (
          <LlamaCppDetails metrics={metrics} slots={slots ?? []} throughput={throughput} history={history} serverId={config.id} color={config.color} />
        ) : config.framework === "vllm-mlx" && online && vllm ? (
          <VllmMlxDetails vllm={vllm} throughput={throughput} history={history} serverId={config.id} color={config.color} />
        ) : !online ? (
          <p className="text-xs text-muted-foreground">Server unavailable</p>
        ) : online ? (
          <p className="text-xs text-muted-foreground">Waiting for data...</p>
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

function VllmMlxDetails({ vllm, throughput, history, serverId, color }: { vllm: NonNullable<ServerStatus["vllm"]>; throughput?: ServerThroughput; history?: TimeSeriesPoint[]; serverId: string; color: string }) {
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

      {vllm.requests && vllm.requests.length > 0 && (
        <RequestList requests={vllm.requests} />
      )}

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

function RequestList({ requests }: { requests: VllmRequest[] }) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs text-muted-foreground font-medium">
        Active Requests ({requests.length})
      </span>
      {requests.map((req) => {
        const pct = Math.min((req.progress ?? 0) * 100, 100);
        const phaseColor =
          req.phase === "generation"
            ? "bg-emerald-500"
            : req.phase === "prefill"
              ? "bg-blue-500"
              : "bg-muted-foreground";
        return (
          <div key={req.request_id} className="space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${phaseColor}`}
                />
                <span className="text-muted-foreground">{req.phase}</span>
              </div>
              <div className="flex items-center gap-2 font-mono tabular-nums">
                {req.phase === "prefill" ? (
                  <>
                    <span className="text-muted-foreground">
                      {req.prompt_tokens > 0 ? `${req.prompt_tokens} tok` : ""}
                    </span>
                    <span className="text-muted-foreground w-10 text-right">
                      {pct.toFixed(0)}%
                    </span>
                  </>
                ) : (
                  <>
                    {req.tokens_per_second != null && (
                      <span>{req.tokens_per_second.toFixed(1)} tok/s</span>
                    )}
                    <span className="text-muted-foreground">
                      {req.completion_tokens}/{req.max_tokens}
                    </span>
                    <span className="text-muted-foreground w-10 text-right">
                      {pct.toFixed(0)}%
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${phaseColor} transition-all duration-500`}
                style={{ width: `${Math.max(pct, 1)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CopyButton({ text, title }: { text: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="text-muted-foreground hover:text-foreground transition-colors"
      title={title}
    >
      {copied ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><polyline points="20 6 9 17 4 12"/></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
      )}
    </button>
  );
}

function CopyableEndpoint({ port }: { port: number }) {
  const url = `http://10.66.66.29:${port}/v1`;

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
        {url}
      </code>
      <CopyButton text={url} title="Copy endpoint URL" />
    </div>
  );
}
