"use client";

import { useState } from "react";

/** A live request's encoded prompt tokens under a key unique across servers. */
export interface RequestSample {
  key: string;
  processed: number;
}

type Sample = { processed: number; at: number; rate: number };

/**
 * Each live request's encoding rate (prompt tokens per second) between the
 * last two polls in which its encoded count changed, by key. Requests that
 * are gone are forgotten. A new poll (a new `timestamp`) is taken while
 * rendering, as useWindowRate does.
 */
export function useRequestRates(
  requests: RequestSample[] | null,
  timestamp: number | undefined,
): Map<string, number> {
  const [samples, setSamples] = useState(new Map<string, Sample>());
  const [seen, setSeen] = useState<number | undefined>(undefined);
  let current = samples;
  if (requests && timestamp && timestamp !== seen) {
    const next = new Map<string, Sample>();
    for (const r of requests) {
      const last = samples.get(r.key);
      if (last && r.processed === last.processed) {
        next.set(r.key, last);
        continue;
      }
      const rate = last && r.processed > last.processed && timestamp > last.at
        ? ((r.processed - last.processed) * 1000) / (timestamp - last.at)
        : last?.rate ?? 0;
      next.set(r.key, { processed: r.processed, at: timestamp, rate });
    }
    setSeen(timestamp);
    setSamples(next);
    current = next;
  }
  return new Map([...current].map(([key, s]) => [key, s.rate]));
}
