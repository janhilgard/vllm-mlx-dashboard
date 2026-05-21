"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useChatStore } from "@/store/chat-store";
import { ChatAttachment } from "@/types/chat";
import { ModelSelector } from "./model-selector";
import { ChatSettingsPopover } from "./chat-settings";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";

export function ChatPanel() {
  const serverId = useChatStore((s) => s.serverId);
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const error = useChatStore((s) => s.error);
  const setServerId = useChatStore((s) => s.setServerId);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopStreaming = useChatStore((s) => s.stopStreaming);
  const clearMessages = useChatStore((s) => s.clearMessages);

  const handleSend = useCallback(
    (content: string, attachments: ChatAttachment[]) => {
      sendMessage(content, attachments);
    },
    [sendMessage]
  );

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-4 border-b">
        <ModelSelector value={serverId} onChange={setServerId} />
        <ChatSettingsPopover />
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearMessages}
            disabled={isStreaming}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Messages */}
      <MessageList messages={messages} />

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onStop={stopStreaming}
        isStreaming={isStreaming}
        disabled={!serverId}
      />
    </div>
  );
}
