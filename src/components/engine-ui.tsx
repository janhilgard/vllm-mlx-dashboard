"use client";

import type { ReactNode } from "react";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs text-muted-foreground font-medium">{title}</span>
      {children}
    </div>
  );
}

/** Horizontal fill bar with a label on the right. `value` is 0–100. */
export function Bar({ value, color, label, marks = [] }: {
  value: number;
  color: string;
  label: string;
  /** Extra vertical marks (0–100), e.g. soft/hard memory limits. */
  marks?: number[];
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
        {marks.map((m, i) => (
          <div key={i} className="absolute top-0 h-full w-px bg-foreground/60" style={{ left: `${Math.min(m, 100)}%` }} />
        ))}
      </div>
      <span className="text-xs font-mono whitespace-nowrap tabular-nums">{label}</span>
    </div>
  );
}

export function fmtBytes(b: number): string {
  if (!b) return "0";
  const gb = b / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(gb >= 100 ? 0 : 1)} GB`;
  const mb = b / 1024 ** 2;
  return `${mb.toFixed(0)} MB`;
}

export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds)) return "—";
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
