import { authHeaders } from "@/lib/fetchers";
import { resolveTarget } from "@/lib/chat-targets";

export const runtime = "nodejs";

// Next.js App Router route handler body size limit
export const maxDuration = 300; // 5 min for slow image processing

/*
 * RATE LIMIT. The dashboard is reachable from the internet without a login
 * (owner's decision, 29 Sept 2026) and oMLX + Splash here are the PRODUCTION
 * models of the crawler. A per-client cap keeps a stray visitor or a script
 * from saturating them: at most CHAT_MAX_PER_WINDOW requests per client in
 * CHAT_WINDOW_MS, CHAT_MAX_CONCURRENT_PER_CLIENT at a time, and
 * CHAT_MAX_CONCURRENT across everyone. Kept in globalThis so it survives
 * module re-evaluation.
 */
const CHAT_WINDOW_MS = 10 * 60_000;
const CHAT_MAX_PER_WINDOW = 30;
const CHAT_MAX_CONCURRENT_PER_CLIENT = 2;
const CHAT_MAX_CONCURRENT = 4;
const CHAT_MAX_TOKENS = 8192;
const rl = globalThis as unknown as { __chatHits?: Map<string, number[]>; __chatActive?: Map<string, number> };
const hits = (rl.__chatHits ??= new Map());
const active = (rl.__chatActive ??= new Map());

function clientKey(req: Request): string {
  // nginx on the public host forwards the client address; direct LAN access has none.
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || "direct";
}

function tooMany(message: string, retryAfterS: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": String(retryAfterS) },
  });
}

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  // Read body as text to bypass default json size limit
  const text = await req.text();
  return JSON.parse(text);
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await parseBody(req);
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid or too large request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { serverId, messages, maxTokens, temperature, topP, reasoning } = body;

  const target = await resolveTarget(serverId);
  if (!target) {
    return new Response(JSON.stringify({ error: "Unknown server or model" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { server, model } = target;
  // An unloaded oMLX model would be LOADED by the first request — on a public
  // page that lets anyone evict the production models (the fallback 35B, the
  // second judge). Loading stays an admin action.
  if (!target.loaded) {
    return new Response(JSON.stringify({ error: `Model ${model} is not loaded — load it in the oMLX admin first` }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  const who = clientKey(req);
  const now = Date.now();
  const recent = (hits.get(who) ?? []).filter((t: number) => now - t < CHAT_WINDOW_MS);
  if (recent.length >= CHAT_MAX_PER_WINDOW) {
    return tooMany(`Rate limit: ${CHAT_MAX_PER_WINDOW} messages per ${CHAT_WINDOW_MS / 60_000} min`, Math.ceil((CHAT_WINDOW_MS - (now - recent[0])) / 1000));
  }
  const mine = active.get(who) ?? 0;
  const everyone = [...active.values()].reduce((a: number, b: number) => a + b, 0);
  if (mine >= CHAT_MAX_CONCURRENT_PER_CLIENT || everyone >= CHAT_MAX_CONCURRENT) {
    return tooMany("Too many chats running at once — try again in a moment", 10);
  }
  recent.push(now);
  hits.set(who, recent);
  active.set(who, mine + 1);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    const n = (active.get(who) ?? 1) - 1;
    if (n > 0) active.set(who, n); else active.delete(who);
  };

  const url = `http://localhost:${server.port}/v1/chat/completions`;
  // Splash ignores chat_template_kwargs.enable_thinking and follows
  // reasoning_effort instead (server default: none).
  const splash = server.framework === "splash";

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(server) },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: Math.min(Number(maxTokens) || CHAT_MAX_TOKENS, CHAT_MAX_TOKENS),
        temperature: temperature ?? 0.7,
        top_p: topP ?? 0.95,
        stream: true,
        ...(splash
          ? { reasoning_effort: reasoning === false ? "none" : "medium" }
          : reasoning === false && { chat_template_kwargs: { enable_thinking: false } }),
      }),
    });
  } catch (err) {
    release();
    const detail = err instanceof Error ? err.message : "";
    return new Response(
      JSON.stringify({
        error: `Server ${server.name} is not reachable: ${detail}`,
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!upstream.ok) {
    release();
    const text = await upstream.text().catch(() => "Unknown error");
    return new Response(
      JSON.stringify({ error: `Upstream error ${upstream.status}: ${text}` }),
      { status: upstream.status, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!upstream.body) {
    release();
    return new Response(
      JSON.stringify({ error: "No response body from upstream" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // Pipe SSE stream through
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const reader = upstream.body.getReader();
  const encoder = new TextEncoder();

  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          await writer.write(encoder.encode("data: [DONE]\n\n"));
          break;
        }
        await writer.write(value);
      }
    } catch {
      // Client disconnected or upstream error
    } finally {
      release();
      await writer.close().catch(() => {});
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
