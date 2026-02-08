# vllm-mlx Dashboard

Real-time monitoring dashboard for local LLM inference servers running on Apple Silicon. Tracks both [llama.cpp](https://github.com/ggml-org/llama.cpp) and [vllm-mlx](https://github.com/vllm-project/vllm-mlx) backends from a single UI.

## Features

- **Global stats** — aggregated online count, throughput, token totals, active/deferred requests, slot utilization, GPU usage
- **Per-server cards** with live metrics:
  - **llama.cpp** — generation & prompt tok/s, KV-cache ratio, slot status
  - **vllm-mlx** — uptime, running/waiting requests, completion & prompt tokens, Metal GPU memory (active/peak), KV-cache hit rate & utilization
- **Throughput chart** — real-time tok/s computed from token count deltas (not averaged gauges)
- **GPU chart** — utilization % and power draw over time
- Auto-refresh via SWR polling (2s servers, 5s GPU)

## Monitored Servers

| Server | Port | Framework |
|--------|------|-----------|
| GPT-OSS-20B | 1235 | llama.cpp |
| Qwen3-VL-8B | 1236 | llama.cpp |
| Qwen3-Next-80B | 1237 | llama.cpp |
| Qwen3-30B | 1238 | llama.cpp |
| Qwen3-Next-80B-MLX | 1239 | vllm-mlx |
| GPT-OSS-20B-MLX | 1240 | vllm-mlx |

Server list is configured in `src/lib/server-config.ts`.

## Tech Stack

- **Next.js 16** (App Router)
- **React 19** + **TypeScript**
- **Tailwind CSS 4** + **shadcn/ui**
- **Recharts** for time-series charts
- **SWR** for data fetching

## Getting Started

```bash
npm install
npm run dev
```

Dashboard runs at [http://localhost:3000](http://localhost:3000).

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/servers` | Aggregated status from all configured servers |
| `GET /api/gpu` | GPU utilization and power metrics |

## How It Works

The Next.js API routes poll each inference server on every request:

- **llama.cpp** servers: fetches `/health`, `/metrics` (Prometheus), and `/slots`
- **vllm-mlx** servers: fetches `/health` and `/v1/status` via `Promise.allSettled` — gracefully degrades if `/v1/status` is unavailable

The frontend uses SWR to poll `/api/servers` every 2 seconds and computes real-time throughput from the delta of cumulative token counters between consecutive polls.
