"use client";

import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useChatStore, ChatSettings } from "@/store/chat-store";

const MAX_TOKENS_OPTIONS = [1024, 2048, 4096, 8192, 16384, 32768];

export function ChatSettingsPopover() {
  const settings = useChatStore((s) => s.settings);
  const setSettings = useChatStore((s) => s.setSettings);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0">
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-5">
          <h4 className="font-medium text-sm">Chat Settings</h4>

          {/* Max Tokens */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Max tokens</Label>
              <span className="text-xs text-muted-foreground font-mono">
                {settings.maxTokens.toLocaleString()}
              </span>
            </div>
            <Slider
              value={[MAX_TOKENS_OPTIONS.indexOf(settings.maxTokens)]}
              onValueChange={([i]) =>
                setSettings({ maxTokens: MAX_TOKENS_OPTIONS[i] })
              }
              min={0}
              max={MAX_TOKENS_OPTIONS.length - 1}
              step={1}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>1K</span>
              <span>32K</span>
            </div>
          </div>

          {/* Temperature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Temperature</Label>
              <span className="text-xs text-muted-foreground font-mono">
                {settings.temperature.toFixed(2)}
              </span>
            </div>
            <Slider
              value={[settings.temperature]}
              onValueChange={([v]) =>
                setSettings({ temperature: Math.round(v * 100) / 100 })
              }
              min={0}
              max={2}
              step={0.05}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0 (precise)</span>
              <span>2 (creative)</span>
            </div>
          </div>

          {/* Top P */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Top P</Label>
              <span className="text-xs text-muted-foreground font-mono">
                {settings.topP.toFixed(2)}
              </span>
            </div>
            <Slider
              value={[settings.topP]}
              onValueChange={([v]) =>
                setSettings({ topP: Math.round(v * 100) / 100 })
              }
              min={0}
              max={1}
              step={0.05}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0</span>
              <span>1</span>
            </div>
          </div>

          {/* Reasoning */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Reasoning</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Enable &lt;think&gt; blocks
              </p>
            </div>
            <Switch
              checked={settings.reasoning}
              onCheckedChange={(checked: boolean) =>
                setSettings({ reasoning: checked })
              }
            />
          </div>

          {/* Reset */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() =>
              setSettings({
                maxTokens: 16384,
                temperature: 0.7,
                topP: 0.95,
                reasoning: true,
              } satisfies ChatSettings)
            }
          >
            Reset to defaults
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
