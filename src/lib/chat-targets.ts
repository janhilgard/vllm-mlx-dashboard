import { SERVERS } from "@/lib/server-config";
import { ServerConfig } from "@/types";

/**
 * Chat targets: one per server, except oMLX, which serves several models —
 * each of those is its own target, `omlx::<model id>`.
 */
export interface ChatTarget {
  value: string;
  serverId: string;
  model: string;
  label: string;
  color: string;
  port: number;
  loaded: boolean;
  sizeBytes: number | null;
}

const SEP = "::";

type Rec = Record<string, unknown>;
const g = globalThis as unknown as { __omlxModels?: { t: number; list: Rec[] } };

/** oMLX model list, cached for 15 s — the chat route checks every message against it. */
async function omlxModels(server: ServerConfig): Promise<Rec[]> {
  const c = g.__omlxModels;
  if (c && Date.now() - c.t < 15_000) return c.list;
  const r = await fetch(`http://localhost:${server.port}/admin/api/models`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
  const list = ((await r.json()) as Rec).models as Rec[] | undefined ?? [];
  g.__omlxModels = { t: Date.now(), list };
  return list;
}

export async function chatTargets(): Promise<ChatTarget[]> {
  const out: ChatTarget[] = [];
  for (const s of SERVERS) {
    if (s.framework !== "omlx") {
      out.push({ value: s.id, serverId: s.id, model: s.modelId ?? s.name, label: s.name, color: s.color, port: s.port, loaded: true, sizeBytes: null });
      continue;
    }
    let list: Rec[] = [];
    try { list = await omlxModels(s); } catch { /* oMLX down — no targets from it */ }
    const models = list
      .filter((m) => !m.is_hidden)
      .map((m) => ({
        value: `${s.id}${SEP}${String(m.id)}`, serverId: s.id, model: String(m.id),
        label: `oMLX · ${String(m.id)}`, color: s.color, port: s.port,
        loaded: !!m.loaded, sizeBytes: Number(m.actual_size || m.estimated_size) || null,
      }))
      .sort((a, b) => Number(b.loaded) - Number(a.loaded) || a.model.localeCompare(b.model));
    out.push(...models);
  }
  return out;
}

/** Resolve a chat target id from the browser. Only known targets pass. */
export async function resolveTarget(value: unknown): Promise<{ server: ServerConfig; model: string; loaded: boolean } | null> {
  if (typeof value !== "string") return null;
  const [serverId, ...rest] = value.split(SEP);
  const server = SERVERS.find((s) => s.id === serverId);
  if (!server) return null;
  if (server.framework !== "omlx") return rest.length ? null : { server, model: server.modelId ?? server.name, loaded: true };
  const model = rest.join(SEP) || server.modelId;
  if (!model) return null;
  const hit = (await omlxModels(server).catch(() => [] as Rec[])).find((m) => String(m.id) === model && !m.is_hidden);
  return hit ? { server, model, loaded: !!hit.loaded } : null;
}
