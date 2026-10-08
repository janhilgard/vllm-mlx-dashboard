import { create } from "zustand";
import { ChatMessage, ChatAttachment } from "@/types/chat";
import { SERVERS } from "@/lib/server-config";

type ApiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function buildApiContent(
  content: string,
  attachments?: ChatAttachment[]
): string | ApiContentPart[] {
  if (!attachments || attachments.length === 0) return content;

  const parts: ApiContentPart[] = [];
  // Text part first (required by most vision models, even if empty)
  parts.push({ type: "text", text: content || "What is in this image?" });
  for (const att of attachments) {
    parts.push({ type: "image_url", image_url: { url: att.dataUrl } });
  }
  return parts;
}

export interface ChatSettings {
  maxTokens: number;
  temperature: number;
  topP: number;
  topK: number;
  minP: number;
  reasoning: boolean;
}

// Sampling for good Czech (measured on ThinkingCap 27B Heretic, 8 Oct 2026):
// min_p drops the improbable tail where invented words and wrong word forms
// come from; a lower temperature does the rest.
export const DEFAULT_SETTINGS: ChatSettings = {
  maxTokens: 16384,
  temperature: 0.6,
  topP: 0.9,
  topK: 20,
  minP: 0.1,
  reasoning: true,
};

interface ChatState {
  serverId: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  settings: ChatSettings;

  setServerId: (id: string) => void;
  setSettings: (patch: Partial<ChatSettings>) => void;
  sendMessage: (content: string, attachments?: ChatAttachment[]) => Promise<void>;
  stopStreaming: () => void;
  clearMessages: () => void;
}

let abortController: AbortController | null = null;

export const useChatStore = create<ChatState>((set, get) => ({
  serverId: SERVERS[0]?.id ?? "",
  messages: [],
  isStreaming: false,
  error: null,
  settings: DEFAULT_SETTINGS,

  setSettings: (patch: Partial<ChatSettings>) => {
    set((state) => ({ settings: { ...state.settings, ...patch } }));
  },

  setServerId: (id: string) => {
    const { serverId, isStreaming } = get();
    if (id === serverId) return;
    if (isStreaming) {
      abortController?.abort();
      abortController = null;
    }
    set({ serverId: id, messages: [], error: null, isStreaming: false });
  },

  sendMessage: async (content: string, attachments?: ChatAttachment[]) => {
    const { messages, isStreaming, serverId, settings } = get();
    if ((!content.trim() && (!attachments || attachments.length === 0)) || isStreaming)
      return;

    set({ error: null });

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
      thinking: null,
      timestamp: Date.now(),
    };

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      thinking: null,
      isStreaming: true,
      timestamp: Date.now(),
    };

    set({
      messages: [...messages, userMsg, assistantMsg],
      isStreaming: true,
    });

    const controller = new AbortController();
    abortController = controller;

    try {
      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: buildApiContent(m.content, m.attachments),
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverId,
          messages: apiMessages,
          maxTokens: settings.maxTokens,
          temperature: settings.temperature,
          topP: settings.topP,
          topK: settings.topK,
          minP: settings.minP,
          reasoning: settings.reasoning,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let contentAcc = "";
      let thinkingAcc = "";
      let inInlineThink = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          if (payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;

            if (delta.reasoning_content) {
              thinkingAcc += delta.reasoning_content;
            }

            if (delta.content) {
              const chunk = delta.content as string;
              for (let i = 0; i < chunk.length; i++) {
                const remaining = chunk.slice(i);
                if (!inInlineThink && remaining.startsWith("<think>")) {
                  inInlineThink = true;
                  i += 6;
                  continue;
                }
                if (inInlineThink && remaining.startsWith("</think>")) {
                  inInlineThink = false;
                  i += 7;
                  continue;
                }
                if (inInlineThink) {
                  thinkingAcc += chunk[i];
                } else {
                  contentAcc += chunk[i];
                }
              }
            }

            const usage = parsed.usage ?? parsed.choices?.[0]?.usage;

            set((state) => {
              const msgs = [...state.messages];
              const last = msgs[msgs.length - 1];
              if (last?.role === "assistant") {
                msgs[msgs.length - 1] = {
                  ...last,
                  content: contentAcc,
                  thinking: thinkingAcc || null,
                  promptTokens: usage?.prompt_tokens ?? last.promptTokens,
                  completionTokens: usage?.completion_tokens ?? last.completionTokens,
                };
              }
              return { messages: msgs };
            });
          } catch {
            // skip malformed JSON
          }
        }
      }

      // Mark streaming complete
      set((state) => {
        const msgs = [...state.messages];
        const last = msgs[msgs.length - 1];
        if (last?.role === "assistant") {
          msgs[msgs.length - 1] = { ...last, isStreaming: false };
        }
        return { messages: msgs, isStreaming: false };
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        set((state) => {
          const msgs = [...state.messages];
          const last = msgs[msgs.length - 1];
          if (last?.role === "assistant") {
            msgs[msgs.length - 1] = { ...last, isStreaming: false };
          }
          return { messages: msgs, isStreaming: false };
        });
      } else {
        const message = err instanceof Error ? err.message : "Unknown error";
        set((state) => {
          const msgs = [...state.messages];
          const last = msgs[msgs.length - 1];
          // Remove empty assistant message on error
          if (last?.role === "assistant" && !last.content && !last.thinking) {
            return { messages: msgs.slice(0, -1), error: message, isStreaming: false };
          }
          if (last?.role === "assistant") {
            msgs[msgs.length - 1] = { ...last, isStreaming: false };
          }
          return { messages: msgs, error: message, isStreaming: false };
        });
      }
    } finally {
      abortController = null;
    }
  },

  stopStreaming: () => {
    abortController?.abort();
  },

  clearMessages: () => {
    set({ messages: [], error: null });
  },
}));
