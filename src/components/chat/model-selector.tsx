"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SERVERS } from "@/lib/server-config";

interface ModelSelectorProps {
  value: string;
  onChange: (serverId: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[240px]">
        <SelectValue placeholder="Select model" />
      </SelectTrigger>
      <SelectContent>
        {SERVERS.map((server) => (
          <SelectItem key={server.id} value={server.id}>
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: server.color }}
              />
              <span>{server.name}</span>
              <span className="text-muted-foreground text-xs">
                :{server.port}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
