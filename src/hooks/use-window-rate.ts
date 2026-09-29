"use client";

import { useRef } from "react";

/**
 * Rates from cumulative counters over a sliding window of recent polls.
 * Returns per-second rates of each counter, or null until two samples span
 * at least `minMs`. A counter that goes backwards (server restart) resets
 * the window instead of producing a negative rate.
 */
export function useWindowRate<K extends string>(
  sample: Record<K, number> | null,
  timestamp: number | undefined,
  windowMs = 20_000,
  minMs = 3_000,
): Record<K, number> | null {
  const buf = useRef<Array<{ t: number; v: Record<K, number> }>>([]);
  if (sample && timestamp) {
    const last = buf.current[buf.current.length - 1];
    if (!last || last.t !== timestamp) {
      if (last && Object.keys(sample).some((k) => sample[k as K] < last.v[k as K])) buf.current = [];
      buf.current.push({ t: timestamp, v: sample });
      while (buf.current.length > 2 && timestamp - buf.current[0].t > windowMs) buf.current.shift();
    }
  }
  const b = buf.current;
  if (b.length < 2) return null;
  const first = b[0], lastS = b[b.length - 1];
  const dt = lastS.t - first.t;
  if (dt < minMs) return null;
  const out = {} as Record<K, number>;
  for (const k of Object.keys(lastS.v) as K[]) out[k] = (lastS.v[k] - first.v[k]) / (dt / 1000);
  return out;
}
