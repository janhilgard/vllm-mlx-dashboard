"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ServerStatus } from "@/types";
import { useRequestRates } from "@/hooks/use-request-rates";
import { RequestList, RequestRowData, requestKey } from "./request-progress";

/**
 * Every live request on every Splash server in one list, each with its
 * server, phase and progress, in server order and then submission order so
 * rows keep their place between polls.
 */
export function LiveRequests({ servers, timestamp }: { servers: ServerStatus[]; timestamp?: number }) {
  const live = servers.flatMap((server) =>
    (server.online ? server.splash?.active_requests ?? [] : []).map((request) => ({
      key: requestKey(server.config.id, request.id),
      request,
      server: { name: server.config.name.replace(/^Splash · /, ""), color: server.config.color },
    })),
  );
  const rates = useRequestRates(live.map((r) => ({ key: r.key, processed: r.request.prompt_processed })), timestamp);
  const rows: RequestRowData[] = live.map((r) => ({ ...r, rate: rates.get(r.key) ?? 0 }));
  const count = (phase: string) => rows.filter((r) => r.request.phase === phase).length;
  const waiting = rows.length - count("prefill") - count("decode");
  const priorities = ["foreground", "normal", "background"]
    .map((p) => [p, rows.filter((r) => r.request.priority === p).length] as const)
    .filter(([, n]) => n > 0);
  const unreported = servers.filter((s) => s.config.framework === "splash" && s.online && s.splash && s.splash.active_requests == null);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle className="text-sm font-medium">Live requests</CardTitle>
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {rows.length} running · {count("prefill")} encoding · {count("decode")} decoding · {waiting} waiting
            {priorities.length > 0 && ` · ${priorities.map(([p, n]) => `${n} ${p}`).join(" · ")}`}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <RequestList rows={rows} empty="No requests running." />
        {unreported.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            Not reported by: {unreported.map((s) => s.config.name).join(", ")} (Splash build without /status active_requests).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
