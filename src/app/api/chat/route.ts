import { SERVERS } from "@/lib/server-config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { serverId, messages, maxTokens, temperature, topP, reasoning } =
    await req.json();

  const server = SERVERS.find((s) => s.id === serverId);
  if (!server) {
    return new Response(JSON.stringify({ error: "Unknown server" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = `http://localhost:${server.port}/v1/chat/completions`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: server.modelId ?? server.name,
        messages,
        max_tokens: maxTokens ?? 16384,
        temperature: temperature ?? 0.7,
        top_p: topP ?? 0.95,
        stream: true,
        ...(reasoning === false && {
          chat_template_kwargs: { enable_thinking: false },
        }),
      }),
    });
  } catch {
    return new Response(
      JSON.stringify({ error: `Server ${server.name} is not reachable` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "Unknown error");
    return new Response(
      JSON.stringify({ error: `Upstream error ${upstream.status}: ${text}` }),
      { status: upstream.status, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!upstream.body) {
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
