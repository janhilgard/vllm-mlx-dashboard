"use client";

import { SplashActiveRequest } from "@/types";
import { formatNumber } from "./metric-value";
import { Bar, fmtDuration } from "./engine-ui";

/** A token count: whole below a thousand, then 1.2K / 3.4M. */
const tok = (n: number) => (n >= 1_000 ? formatNumber(n) : String(Math.round(n)));

const PHASE_STYLE: Record<string, string> = {
  prefill: "bg-blue-500/20 text-blue-400",
  decode: "bg-emerald-500/20 text-emerald-400",
  queued: "bg-amber-500/20 text-amber-400",
  waiting_resources: "bg-red-500/20 text-red-400",
  waiting_prefix: "bg-amber-500/20 text-amber-400",
  waiting_mask: "bg-amber-500/20 text-amber-400",
};

const PRIORITY_STYLE: Record<string, string> = {
  foreground: "bg-orange-500/20 text-orange-400",
  normal: "bg-muted text-muted-foreground",
  background: "bg-muted/50 text-muted-foreground/70",
};

/** The key of a request in rate maps: request ids repeat across servers. */
export const requestKey = (serverId: string, id: number) => `${serverId}:${id}`;

export interface RequestRowData {
  key: string;
  request: SplashActiveRequest;
  /** Encoding rate in prompt tokens per second, 0 when unknown. */
  rate: number;
  /** The server, shown in lists that span servers. */
  server?: { name: string; color: string };
}

/**
 * One live request: its phase and priority, prompt tokens encoded (prefix-cache hits count
 * as encoded), encoding rate and time left at that rate, generated tokens and age.
 */
export function RequestRow({ row }: { row: RequestRowData }) {
  const { request: r, rate, server } = row;
  const pct = r.prompt_tokens ? (r.prompt_processed / r.prompt_tokens) * 100 : 0;
  const encoding = r.prompt_processed < r.prompt_tokens;
  const left = encoding && rate > 0 ? (r.prompt_tokens - r.prompt_processed) / rate : null;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5 min-w-0">
          {server && (
            <span className="flex items-center gap-1 truncate">
              <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: server.color }} />
              <span className="truncate">{server.name}</span>
            </span>
          )}
          <span className="font-mono text-muted-foreground">#{r.id}</span>
          <span className={`rounded px-1.5 py-0.5 ${PHASE_STYLE[r.phase] ?? "bg-muted text-muted-foreground"}`}>
            {r.phase.replace("_", " ")}
          </span>
          {r.priority && (
            <span className={`rounded px-1.5 py-0.5 ${PRIORITY_STYLE[r.priority] ?? "bg-muted text-muted-foreground"}`}
                  title="request priority">
              {r.priority}
            </span>
          )}
        </span>
        <span className="font-mono tabular-nums text-muted-foreground shrink-0">
          {encoding && rate > 0 ? `${rate.toFixed(0)} tok/s · ~${fmtDuration(left ?? 0)} left · ` : ""}
          gen {tok(r.generated_tokens)}/{tok(r.max_new_tokens)} · {fmtDuration(r.age_ms / 1000)}
        </span>
      </div>
      <Bar value={pct} color={encoding ? "bg-blue-500" : "bg-emerald-500"}
           label={`encoded ${tok(r.prompt_processed)} / ${tok(r.prompt_tokens)} tok · ${pct.toFixed(0)}%`} />
    </div>
  );
}

export function RequestList({ rows, empty = "No requests." }: { rows: RequestRowData[]; empty?: string }) {
  if (!rows.length) return <p className="text-xs text-muted-foreground">{empty}</p>;
  return (
    <div className="space-y-2">
      {rows.map((row) => <RequestRow key={row.key} row={row} />)}
    </div>
  );
}
