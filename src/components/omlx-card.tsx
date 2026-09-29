"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OmlxModel, OmlxTotals, ServerStatus, TimeSeriesPoint } from "@/types";
import type { ServerThroughput } from "@/hooks/use-realtime-throughput";
import { StatusBadge } from "./status-badge";
import { MetricValue, formatNumber } from "./metric-value";
import { MultiChart } from "./multi-chart";
import { Bar, Section, fmtBytes, fmtDuration } from "./engine-ui";

/**
 * oMLX serves several models from one process. Unlike Splash it exposes every
 * request individually — queued (with its position), in prefill (processed /
 * total, speed, ETA) and generating (tokens, tok/s) — so the card lists them.
 */
export function OmlxCard({ server, throughput, history }: {
  server: ServerStatus;
  throughput?: ServerThroughput;
  history: TimeSeriesPoint[];
}) {
  const { config, online, omlx, error } = server;
  const o = omlx;
  const busy = o ? o.total_active > 0 : false;

  return (
    <Card className="relative overflow-hidden md:col-span-2 lg:col-span-3">
      <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: config.color }} />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-medium">{config.name}</CardTitle>
            {config.role && <p className="text-xs text-muted-foreground">{config.role}</p>}
          </div>
          <StatusBadge online={online} processing={busy} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">:{config.port}</Badge>
          <Badge variant="secondary" className="text-xs">omlx</Badge>
          {o?.session && <span className="text-xs text-muted-foreground">up {fmtDuration(o.session.uptime_seconds)}</span>}
        </div>
      </CardHeader>
      <CardContent>
        {!online ? (
          <p className="text-xs text-muted-foreground">Server unavailable</p>
        ) : !o ? (
          <p className="text-xs text-red-400">{error ?? "Waiting for data..."}</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <MetricValue label="Generation" value={throughput?.generation ?? 0} suffix="tok/s" />
                <MetricValue label="Prompt" value={throughput?.prompt ?? 0} suffix="tok/s" />
                <MetricValue label="Running" value={`${o.total_active}`} />
                <MetricValue label="Waiting" value={`${o.total_waiting}`} highlight={o.total_waiting > 0} />
              </div>

              <Section title="Model memory">
                <Bar value={o.memory_max_bytes ? (o.memory_used_bytes / o.memory_max_bytes) * 100 : 0}
                     color={o.pressure === "ok" ? "bg-blue-500" : "bg-amber-500"}
                     marks={[o.memory_soft_bytes, o.memory_hard_bytes].filter((x): x is number => x != null)
                       .map((x) => (x / o.memory_max_bytes) * 100)}
                     label={`${fmtBytes(o.memory_used_bytes)} / ${fmtBytes(o.memory_max_bytes)} · ${o.pressure}`} />
                <p className="text-[10px] text-muted-foreground">
                  marks: soft {fmtBytes(o.memory_soft_bytes ?? 0)} · hard {fmtBytes(o.memory_hard_bytes ?? 0)} (unpinned models get evicted above soft)
                </p>
              </Section>

              <Section title={`Loaded models (${o.models.length})`}>
                <div className="space-y-3">
                  {o.models.map((m) => <ModelBlock key={m.id} m={m} />)}
                </div>
              </Section>

              {o.available.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Installed, not loaded ({o.available.length})</summary>
                  <div className="mt-1 space-y-0.5 font-mono">
                    {o.available.map((a) => (
                      <div key={a.id} className="flex justify-between gap-2">
                        <span className="truncate">{a.id}</span>
                        <span className="text-muted-foreground">{fmtBytes(a.size_bytes)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>

            <div className="space-y-4">
              <MultiChart data={history} title="Tokens per second" series={[
                { key: `${config.id}_prompt`, name: "prompt", color: "#3b82f6" },
                { key: config.id, name: "generation", color: config.color },
              ]} />
              <MultiChart data={history} title="Requests" height={90} series={[
                { key: `${config.id}_requests`, name: "running", color: "#22c55e" },
                { key: `${config.id}_waiting`, name: "waiting", color: "#ef4444" },
              ]} />
              <Totals title="Since server start" t={o.session} />
              <Totals title="All time" t={o.alltime} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ModelBlock({ m }: { m: OmlxModel }) {
  const state = m.is_loading
    ? `loading${m.loading_remaining_seconds != null ? ` · ~${fmtDuration(m.loading_remaining_seconds)}` : ""}`
    : m.active_requests || m.waiting_requests
      ? `${m.active_requests} running${m.waiting_requests ? ` · ${m.waiting_requests} waiting` : ""}`
      : `idle ${fmtDuration(m.idle_seconds)}`;
  return (
    <div className="rounded-md bg-muted/40 p-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-mono truncate">{m.id}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {m.pinned && <Badge variant="outline" className="text-[10px] px-1 py-0">pinned</Badge>}
          {m.dflash && <Badge variant="outline" className="text-[10px] px-1 py-0">dflash</Badge>}
          <span className="font-mono text-muted-foreground">{fmtBytes(m.size_bytes)}</span>
          <span className={m.active_requests || m.waiting_requests ? "text-emerald-400" : "text-muted-foreground"}>{state}</span>
        </span>
      </div>

      {m.waiting.map((w) => (
        <div key={w.request_id} className="flex justify-between text-xs">
          <span className="text-amber-400">● queued #{w.queue_position}</span>
          <span className="font-mono tabular-nums text-muted-foreground">
            {formatNumber(w.prompt_tokens)} tok · waiting {w.elapsed_seconds.toFixed(1)}s
          </span>
        </div>
      ))}
      {m.prefilling.map((p) => {
        const pct = p.total ? (p.processed / p.total) * 100 : 0;
        return (
          <div key={p.request_id} className="space-y-0.5">
            <div className="flex justify-between text-xs">
              <span className="text-blue-400">● {p.phase}</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {formatNumber(p.processed)}/{formatNumber(p.total)} tok · {p.speed.toFixed(0)} tok/s
                {p.eta != null ? ` · ETA ${p.eta.toFixed(1)}s` : ""}{p.cached_tokens ? ` · cached ${formatNumber(p.cached_tokens)}` : ""}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.max(pct, 1)}%` }} />
            </div>
          </div>
        );
      })}
      {m.generating.map((g) => {
        const pct = g.max_tokens ? (g.generated_tokens / g.max_tokens) * 100 : 0;
        return (
          <div key={g.request_id} className="space-y-0.5">
            <div className="flex justify-between text-xs">
              <span className="text-emerald-400">● generating</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {g.tokens_per_second.toFixed(1)} tok/s · {g.generated_tokens}/{g.max_tokens ?? "?"} · prompt {formatNumber(g.prompt_tokens)}
                {g.elapsed_seconds != null ? ` · ${g.elapsed_seconds.toFixed(1)}s` : ""}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.max(pct, 1)}%` }} />
            </div>
          </div>
        );
      })}

      {m.cache && (
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <span className="text-muted-foreground">Prefix blocks</span>
            <span className="font-mono ml-1">{m.cache.indexed_blocks} × {formatNumber(m.cache.block_size)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">SSD</span>
            <span className="font-mono ml-1">{fmtBytes(m.cache.ssd_bytes)} / {fmtBytes(m.cache.ssd_max_bytes)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Hot</span>
            <span className="font-mono ml-1">{fmtBytes(m.cache.hot_bytes)} / {fmtBytes(m.cache.hot_max_bytes)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Totals({ title, t }: { title: string; t: OmlxTotals | null }) {
  if (!t) return null;
  return (
    <Section title={title}>
      <div className="grid grid-cols-4 gap-3">
        <MetricValue label="Requests" value={t.requests} />
        <MetricValue label="Prompt tok." value={t.prompt_tokens} />
        <MetricValue label="Completion tok." value={t.completion_tokens} />
        <MetricValue label="Cache hit" value={`${t.cache_efficiency.toFixed(1)}`} suffix="%" />
        <MetricValue label="Avg prefill" value={t.avg_prefill_tps} suffix="tok/s" />
        <MetricValue label="Avg generation" value={t.avg_generation_tps} suffix="tok/s" />
        <MetricValue label="Cached tok." value={t.cached_tokens} />
        <MetricValue label="Uptime" value={fmtDuration(t.uptime_seconds)} />
      </div>
    </Section>
  );
}
