"use client";

import useSWR from "swr";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChatTarget } from "@/lib/chat-targets";

interface ModelSelectorProps {
  value: string;
  onChange: (targetId: string) => void;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function size(b: number | null): string {
  if (!b) return "";
  return `${(b / 1024 ** 3).toFixed(0)} GB`;
}

/**
 * One entry per chat target: Splash, and every model oMLX knows about.
 * Models oMLX has not loaded are listed but disabled — the first request
 * would load them, and on a public page that could evict production models.
 */
export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const { data } = useSWR<{ targets: ChatTarget[] }>("/api/models", fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: false,
  });
  const targets = data?.targets ?? [];
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[360px]">
        <SelectValue placeholder="Select model" />
      </SelectTrigger>
      <SelectContent>
        {targets.map((t) => (
          <SelectItem key={t.value} value={t.value} disabled={!t.loaded}>
            <span className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
              <span className={t.loaded ? "" : "text-muted-foreground"}>{t.label}</span>
              <span className="text-muted-foreground text-xs">
                :{t.port}{t.sizeBytes ? ` · ${size(t.sizeBytes)}` : ""}{t.loaded ? "" : " · not loaded"}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
