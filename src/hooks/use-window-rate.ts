"use client";

import { useState } from "react";

type Sample<K extends string> = { t: number; v: Record<K, number> };

/**
 * Rates from cumulative counters over a sliding window of recent polls.
 * Returns per-second rates of each counter, or null until two samples span
 * at least `minMs`. A counter that goes backwards (server restart) resets
 * the window instead of producing a negative rate. Each new poll (a new
 * `timestamp`) is added to the window while rendering, as React's "storing
 * information from previous renders" pattern does.
 */
export function useWindowRate<K extends string>(
  sample: Record<K, number> | null,
  timestamp: number | undefined,
  windowMs = 20_000,
  minMs = 3_000,
): Record<K, number> | null {
  const [window, setWindow] = useState<Sample<K>[]>([]);
  const [seen, setSeen] = useState<number | undefined>(undefined);
  let b = window;
  if (sample && timestamp && timestamp !== seen) {
    const last = b[b.length - 1];
    const restarted = last && Object.keys(sample).some((k) => sample[k as K] < last.v[k as K]);
    const next = [...(restarted ? [] : b), { t: timestamp, v: sample }];
    while (next.length > 2 && timestamp - next[0].t > windowMs) next.shift();
    setSeen(timestamp);
    setWindow(next);
    b = next;
  }
  if (b.length < 2) return null;
  const first = b[0], lastS = b[b.length - 1];
  const dt = lastS.t - first.t;
  if (dt < minMs) return null;
  const out = {} as Record<K, number>;
  for (const k of Object.keys(lastS.v) as K[]) out[k] = (lastS.v[k] - first.v[k]) / (dt / 1000);
  return out;
}
