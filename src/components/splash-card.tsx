"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ServerStatus, SplashStatus, TimeSeriesPoint } from "@/types";
import { useWindowRate } from "@/hooks/use-window-rate";
import { useRequestRates } from "@/hooks/use-request-rates";
import { RequestList, requestKey } from "./request-progress";
import { StatusBadge } from "./status-badge";
import { MetricValue, formatNumber } from "./metric-value";
import { MultiChart } from "./multi-chart";
import { Bar, Section, fmtBytes, fmtDuration } from "./engine-ui";

/**
 * Splash (DFlash2 speculative decoding). The engine reports how many requests
 * sit in each stage but not the requests themselves, so the "queue" here is
 * the stage pipeline plus the batches running right now.
 *
 * Two tok/s per phase, because they answer different questions:
 * - throughput: tokens per second of wall-clock time — what the server delivers;
 * - kernel: tokens per second of time the GPU actually spent in that phase —
 *   how fast it works when it works. The gap is idle time.
 */
export function SplashCard({ server, history, timestamp }: {
  server: ServerStatus;
  history: TimeSeriesPoint[];
  timestamp?: number;
}) {
  const { config, online, splash, error } = server;
  const s = splash;
  const rate = useWindowRate(
    s ? {
      pt: s.prefill_input_tokens, pw: s.prefill_wall_ms,
      dt: s.decode_output_tokens, dw: s.decode_wall_ms,
      done: s.requests.completed,
    } : null,
    timestamp,
  );
  const busy = s ? s.stages.prefilling + s.stages.decoding > 0 : false;
  const requestRates = useRequestRates(
    s?.active_requests?.map((r) => ({ key: requestKey(config.id, r.id), processed: r.prompt_processed })) ?? null,
    timestamp,
  );

  return (
    <Card className="relative overflow-hidden md:col-span-2 lg:col-span-3">
      <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: config.color }} />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-medium">{config.name}</CardTitle>
            {config.role && <p className="text-xs text-muted-foreground">{config.role}</p>}
          </div>
          <StatusBadge online={online && !!s?.ready} processing={busy} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">:{config.port}</Badge>
          <Badge variant="secondary" className="text-xs">splash · DFlash2</Badge>
          {s && <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">{s.model}</code>}
          {s?.started_at && timestamp && <span className="text-xs text-muted-foreground">up {fmtDuration(timestamp / 1000 - s.started_at)}</span>}
        </div>
      </CardHeader>
      <CardContent>
        {!online ? (
          <p className="text-xs text-muted-foreground">Server unavailable</p>
        ) : !s ? (
          <p className="text-xs text-red-400">{error ?? "Waiting for data..."}</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <Section title="Request pipeline — now">
                <Pipeline s={s} />
              </Section>

              <Section title="Requests — encoding progress">
                {s.active_requests == null ? (
                  <p className="text-xs text-muted-foreground">Not reported by this Splash build.</p>
                ) : (
                  <RequestList rows={s.active_requests.map((r) => ({
                    key: requestKey(config.id, r.id), request: r, rate: requestRates.get(requestKey(config.id, r.id)) ?? 0,
                  }))} />
                )}
              </Section>

              <Section title="Running batches">
                <div className="grid grid-cols-2 gap-3">
                  <BatchTile label="Encoding (prefill)" b={s.current_prefill} />
                  <BatchTile label="Decoding" b={s.current_decode} decode />
                </div>
              </Section>

              <Section title={`Tokens per second · last ${rate ? "~20 s" : "…"}`}>
                <div className="grid grid-cols-3 gap-3">
                  <MetricValue label="Encoding throughput" value={rate ? rate.pt : 0} suffix="tok/s" />
                  <MetricValue label="Encoding kernel" value={rate && rate.pw > 0 ? rate.pt / (rate.pw / 1000) : s.prefill_wall_ms ? s.prefill_input_tokens / (s.prefill_wall_ms / 1000) : 0} suffix="tok/s" />
                  <MetricValue label="Requests" value={rate ? `${(rate.done * 60).toFixed(1)}` : "—"} suffix="/min" />
                  <MetricValue label="Decoding throughput" value={rate ? rate.dt : 0} suffix="tok/s" />
                  <MetricValue label="Decoding kernel" value={rate && rate.dw > 0 ? rate.dt / (rate.dw / 1000) : s.decode_wall_ms ? s.decode_output_tokens / (s.decode_wall_ms / 1000) : 0} suffix="tok/s" />
                  <MetricValue label="GPU busy" value={rate ? `${Math.min(100, ((rate.pw + rate.dw) / 10)).toFixed(0)}` : "—"} suffix="%" />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  throughput = per wall-clock second · kernel = per second the GPU spent in that phase ·
                  GPU busy = share of time in prefill or decode
                </p>
              </Section>

              <Section title="Latency">
                <div className="grid grid-cols-4 gap-3">
                  <MetricValue label="TTFT p50" value={ms(s.ttft_p50_ms)} />
                  <MetricValue label="TTFT p95" value={ms(s.ttft_p95_ms)} />
                  <MetricValue label="Inter-token p50" value={ms(s.itl_p50_ms)} />
                  <MetricValue label="Inter-token p95" value={ms(s.itl_p95_ms)} />
                </div>
              </Section>
            </div>

            <div className="space-y-4">
              {/* Encoding and decoding differ by an order of magnitude — on one
                  axis the decoding line is flat. Separate charts, own scale,
                  with the window mean (idle included) as the long-run rate. */}
              <MultiChart data={history} title="Encoding tok/s (prefill)" average series={[
                { key: `${config.id}_prompt`, name: "encoding", color: "#3b82f6" },
              ]} />
              <MultiChart data={history} title="Decoding tok/s (generation)" average series={[
                { key: config.id, name: "decoding", color: "#22c55e" },
              ]} />
              <MultiChart data={history} title="Requests" height={90} series={[
                { key: `${config.id}_requests`, name: "running", color: "#22c55e" },
                { key: `${config.id}_waiting`, name: "waiting", color: "#ef4444" },
              ]} />

              <Section title="DFlash2 speculative decoding">
                <Bar value={(s.draft_acceptance ?? 0) * 100} color="bg-emerald-500"
                     label={`${((s.draft_acceptance ?? 0) * 100).toFixed(1)}% accepted`} />
                <div className="grid grid-cols-3 gap-3">
                  <MetricValue label="Drafted" value={s.drafted_tokens} />
                  <MetricValue label="Accepted" value={s.accepted_draft_tokens} />
                  <MetricValue label="Max batch" value={`${s.max_batch_width}`} suffix="req" />
                </div>
                <DecodeWidths widths={s.decode_width} />
              </Section>

              <Section title="Memory & cache">
                <Bar value={s.memory_budget_bytes ? (s.memory_current_bytes / s.memory_budget_bytes) * 100 : 0}
                     color={s.memory_pressure === "normal" ? "bg-blue-500" : "bg-amber-500"}
                     label={`${fmtBytes(s.memory_current_bytes)} / ${fmtBytes(s.memory_budget_bytes)} · ${s.memory_pressure}`} />
                <div className="grid grid-cols-4 gap-3">
                  <MetricValue label="Prefix hit rate" value={`${(s.cache.hit_rate * 100).toFixed(1)}`} suffix="%" />
                  <MetricValue label="Reused tokens" value={s.cache.reused_tokens} />
                  <MetricValue label="KV pages active" value={`${s.kv.pages_active}`} />
                  <MetricValue label="Context" value={formatNumber(s.max_context)} suffix="tok" />
                </div>
              </Section>

              <Section title="Requests since start">
                <div className="grid grid-cols-4 gap-3">
                  <MetricValue label="Completed" value={s.requests.completed} />
                  <MetricValue label="Failed" value={`${s.requests.failed}`} highlight={s.requests.failed > 0} />
                  <MetricValue label="Cancelled" value={`${s.requests.cancelled}`} />
                  <MetricValue label="Capacity/Metal fail." value={`${s.capacity_failures}/${s.metal_failures}`}
                               highlight={s.capacity_failures + s.metal_failures > 0} />
                </div>
              </Section>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ms = (v: number | null) => (v == null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${v.toFixed(0)} ms`);

function Pipeline({ s }: { s: SplashStatus }) {
  const st = s.stages;
  const steps: Array<[string, number, string]> = [
    ["HTTP", st.http_active, "bg-muted text-muted-foreground"],
    ["preparing", st.preparing + st.preparing_waiting, "bg-muted text-muted-foreground"],
    ["queued", st.queued + st.admission_waiting, st.queued + st.admission_waiting ? "bg-amber-500/20 text-amber-400" : "bg-muted text-muted-foreground"],
    ["wait memory", st.waiting_memory, "bg-red-500/20 text-red-400"],
    ["wait prefix", st.waiting_prefix, "bg-amber-500/20 text-amber-400"],
    ["wait mask", st.waiting_mask, "bg-amber-500/20 text-amber-400"],
    ["encoding", st.prefilling, st.prefilling ? "bg-blue-500/20 text-blue-400" : "bg-muted text-muted-foreground"],
    ["decoding", st.decoding, st.decoding ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"],
  ];
  // Wait states only show up when something is in them.
  const shown = steps.filter(([n, v]) => v > 0 || !n.startsWith("wait"));
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {shown.map(([n, v, cls], i) => (
        <span key={n} className="flex items-center gap-1.5">
          <span className={`rounded px-1.5 py-0.5 ${cls}`}>
            {n} <span className="font-mono tabular-nums font-medium">{v}</span>
          </span>
          {i < shown.length - 1 && <span className="text-muted-foreground">→</span>}
        </span>
      ))}
    </div>
  );
}

function BatchTile({ label, b, decode }: { label: string; b: SplashStatus["current_prefill"]; decode?: boolean }) {
  return (
    <div className="rounded-md bg-muted/40 p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      {b ? (
        <div className="font-mono tabular-nums text-sm">
          {b.width} req · {formatNumber(decode ? b.output_tokens : b.input_tokens)} tok
          <div className="text-xs text-muted-foreground">{b.tokens_per_second.toFixed(0)} tok/s · {b.wall_ms.toFixed(0)} ms</div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">idle</div>
      )}
    </div>
  );
}

function DecodeWidths({ widths }: { widths: Record<string, number> }) {
  const entries = Object.entries(widths).sort(([a], [b]) => a.localeCompare(b));
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (!total) return null;
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">Decode batches by width (requests per step)</span>
      {entries.map(([w, v]) => (
        <div key={w} className="flex items-center gap-2 text-xs">
          <span className="w-6 font-mono text-muted-foreground">{w}</span>
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${(v / total) * 100}%` }} />
          </div>
          <span className="w-20 text-right font-mono tabular-nums">{formatNumber(v)} · {((v / total) * 100).toFixed(0)}%</span>
        </div>
      ))}
    </div>
  );
}
