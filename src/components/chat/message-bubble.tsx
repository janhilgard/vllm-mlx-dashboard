"use client";

import { ChatMessage } from "@/types/chat";
import { ThinkingBlock } from "./thinking-block";
import { MarkdownContent } from "./markdown-content";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-4 py-2.5",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {/* Image attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {message.attachments.map((att) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={att.id}
                src={att.dataUrl}
                alt={att.file.name}
                className="max-h-48 max-w-full rounded-md object-contain"
              />
            ))}
          </div>
        )}

        {/* Thinking block for assistant */}
        {!isUser && message.thinking && (
          <ThinkingBlock
            content={message.thinking}
            isStreaming={message.isStreaming}
          />
        )}

        {/* Message content */}
        {isUser ? (
          <div className="whitespace-pre-wrap text-sm leading-relaxed break-words">
            {message.content}
          </div>
        ) : (
          <>
            {message.content ? (
              <MarkdownContent content={message.content} />
            ) : (
              message.isStreaming &&
              !message.thinking && (
                <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5 align-text-bottom" />
              )
            )}
          </>
        )}

        {/* Token counts */}
        {!isUser && !message.isStreaming && message.completionTokens != null && (
          <div className="mt-1.5 text-[10px] text-muted-foreground/70">
            {message.promptTokens != null && (
              <span>{message.promptTokens} prompt &middot; </span>
            )}
            {message.completionTokens} completion tokens
          </div>
        )}
      </div>
    </div>
  );
}
