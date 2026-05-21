"use client";

import { useState, useCallback, useRef, KeyboardEvent, ClipboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Square, Paperclip, X } from "lucide-react";
import { ChatAttachment } from "@/types/chat";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

interface ChatInputProps {
  onSend: (content: string, attachments: ChatAttachment[]) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ChatInput({ onSend, onStop, isStreaming, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const toAdd: ChatAttachment[] = [];
    for (const file of Array.from(files)) {
      if (!ACCEPTED_TYPES.includes(file.type)) continue;
      if (file.size > MAX_FILE_SIZE) continue;
      const dataUrl = await readFileAsDataUrl(file);
      toAdd.push({ id: crypto.randomUUID(), file, dataUrl });
    }
    if (toAdd.length > 0) {
      setAttachments((prev) => [...prev, ...toAdd]);
    }
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleSend = useCallback(() => {
    if ((!input.trim() && attachments.length === 0) || isStreaming) return;
    onSend(input, attachments);
    setInput("");
    setAttachments([]);
  }, [input, attachments, isStreaming, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === "file" && ACCEPTED_TYPES.includes(item.type)) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        addFiles(imageFiles);
      }
    },
    [addFiles]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        addFiles(e.target.files);
        e.target.value = "";
      }
    },
    [addFiles]
  );

  const canSend = input.trim() || attachments.length > 0;

  return (
    <div className="border-t">
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex gap-2 px-4 pt-3 flex-wrap">
          {attachments.map((att) => (
            <div key={att.id} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={att.dataUrl}
                alt={att.file.name}
                className="h-16 w-16 rounded-md object-cover border"
              />
              <button
                onClick={() => removeAttachment(att.id)}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 p-4">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Attach button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isStreaming}
          className="shrink-0"
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          className="min-h-[44px] max-h-[160px] resize-none"
          rows={1}
          disabled={disabled}
        />

        {isStreaming ? (
          <Button
            variant="destructive"
            size="icon"
            onClick={onStop}
            className="shrink-0"
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!canSend || disabled}
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
