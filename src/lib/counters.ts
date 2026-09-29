import { ServerStatus } from "@/types";

/**
 * One view of every engine for the aggregates and charts: cumulative token
 * counters (throughput = their delta over time) and how many requests are
 * running / waiting right now. Keeps the hooks and the global stats in sync —
 * each engine reports these under different names.
 */
export interface Counters {
  gen: number;
  prompt: number;
  running: number;
  waiting: number;
}

export function counters(server: ServerStatus): Counters | null {
  if (server.config.framework === "llama.cpp" && server.metrics) {
    return {
      gen: server.metrics.tokens_predicted_total,
      prompt: server.metrics.prompt_tokens_total,
      running: server.metrics.requests_processing,
      waiting: server.metrics.requests_deferred,
    };
  }
  if (server.omlx) {
    const o = server.omlx;
    const inflightGen = o.models.reduce((s, m) => s + m.generating.reduce((g, r) => g + r.generated_tokens, 0), 0);
    const inflightPrompt = o.models.reduce((s, m) => s + m.prefilling.reduce((g, r) => g + r.processed, 0), 0);
    return {
      gen: (o.session?.completion_tokens ?? 0) + inflightGen,
      prompt: (o.session?.prompt_tokens ?? 0) + inflightPrompt,
      running: o.total_active,
      waiting: o.total_waiting,
    };
  }
  if (server.splash) {
    const s = server.splash, st = s.stages;
    return {
      gen: s.decode_output_tokens,
      prompt: s.prefill_input_tokens,
      running: st.prefilling + st.decoding,
      waiting: st.queued + st.admission_waiting + st.waiting_memory + st.waiting_prefix + st.waiting_mask + st.preparing_waiting,
    };
  }
  if (server.vllm) {
    const reqs = server.vllm.requests ?? [];
    return {
      gen: server.vllm.total_completion_tokens + reqs.reduce((s, r) => s + (r.completion_tokens ?? 0), 0),
      prompt: server.vllm.total_prompt_tokens + reqs.reduce((s, r) => s + (r.prompt_tokens ?? 0), 0),
      running: server.vllm.num_running,
      waiting: server.vllm.num_waiting,
    };
  }
  return null;
}
