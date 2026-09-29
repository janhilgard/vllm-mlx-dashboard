"use client";

import dynamic from "next/dynamic";
import { SERVERS } from "@/lib/server-config";

// Tabs use Radix's useId() which can produce different IDs on server vs
// client when anything (e.g. a browser extension, theme provider, or any
// other tree shift) re-positions the component, causing a hydration
// mismatch on aria-controls/id. Loading the tabbed shell as a client-only
// chunk sidesteps the SSR/CSR id drift entirely.
const AppShell = dynamic(
  () => import("@/components/app-shell").then((m) => m.AppShell),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto">
        <header className="px-6 pt-6 pb-2">
          <h1 className="text-xl font-semibold">LLM Inference Monitor</h1>
          <p className="text-sm text-muted-foreground">
            Mac Studio M3 Ultra &middot; {SERVERS.length} {SERVERS.length === 1 ? "server" : "servers"} ({SERVERS.map((s) => s.name.split(" ")[0]).join(", ")}) &middot; auto-refresh 2s
          </p>
        </header>
        <AppShell />
      </div>
    </main>
  );
}
