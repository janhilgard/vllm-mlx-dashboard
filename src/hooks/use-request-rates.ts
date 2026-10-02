"use client";

import { useState } from "react";
import { SplashActiveRequest } from "@/types";

type Sample = { processed: number; at: number; rate: number };

/**
 * Each live request's encoding rate (prompt tokens per second) between the
 * last two polls in which its encoded count changed, keyed by request id.
 * Requests that are gone are forgotten. A new poll (a new `timestamp`) is
 * taken while rendering, as useWindowRate does.
 */
export function useRequestRates(
  requests: SplashActiveRequest[] | null,
  timestamp: number | undefined,
): Map<number, number> {
  const [samples, setSamples] = useState(new Map<number, Sample>());
  const [seen, setSeen] = useState<number | undefined>(undefined);
  let current = samples;
  if (requests && timestamp && timestamp !== seen) {
    const next = new Map<number, Sample>();
    for (const r of requests) {
      const last = samples.get(r.id);
      if (last && r.prompt_processed === last.processed) {
        next.set(r.id, last);
        continue;
      }
      const rate = last && r.prompt_processed > last.processed && timestamp > last.at
        ? ((r.prompt_processed - last.processed) * 1000) / (timestamp - last.at)
        : last?.rate ?? 0;
      next.set(r.id, { processed: r.prompt_processed, at: timestamp, rate });
    }
    setSeen(timestamp);
    setSamples(next);
    current = next;
  }
  return new Map([...current].map(([id, s]) => [id, s.rate]));
}
