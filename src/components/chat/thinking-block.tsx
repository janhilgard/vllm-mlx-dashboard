"use client";

import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState, useEffect, useRef } from "react";

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
}

export function ThinkingBlock({ content, isStreaming }: ThinkingBlockProps) {
  // Open while streaming; closes when streaming finishes (a block rendered
  // after its stream starts closed).
  const [open, setOpen] = useState(!!isStreaming);
  const [wasStreaming, setWasStreaming] = useState(!!isStreaming);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!!isStreaming !== wasStreaming) {
    setWasStreaming(!!isStreaming);
    setOpen(!!isStreaming);
  }

  // Auto-scroll to bottom during streaming
  useEffect(() => {
    if (isStreaming && open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content, isStreaming, open]);

  const lines = content.split("\n").length;
  const chars = content.length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
        />
        <span>
          {isStreaming ? "Thinking..." : `Thought (${lines} lines, ${chars} chars)`}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          ref={scrollRef}
          className="mt-1 rounded-md bg-muted/50 border border-border/50 p-3 text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto"
        >
          {content}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
