export interface ChatAttachment {
  id: string;
  file: File;
  dataUrl: string; // base64 data URL for preview & API
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
  thinking: string | null;
  isStreaming?: boolean;
  promptTokens?: number;
  completionTokens?: number;
  timestamp: number;
}
