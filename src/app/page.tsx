import { AppShell } from "@/components/app-shell";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto">
        <header className="px-6 pt-6 pb-2">
          <h1 className="text-xl font-semibold">LLM Inference Monitor</h1>
          <p className="text-sm text-muted-foreground">
            Mac Studio M3 Ultra &middot; 3 servers &middot; auto-refresh 2s
          </p>
        </header>
        <AppShell />
      </div>
    </main>
  );
}
