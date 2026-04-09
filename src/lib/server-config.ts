import { ServerConfig } from "@/types";

export const SERVERS: ServerConfig[] = [
  {
    id: "qwen35-122b-mlx",
    name: "Qwen3.5-122B-A10B-mixed-6-8",
    modelId: "/Users/janhilgard/mlx-models/Qwen3.5-122B-A10B-mlx-mixed-6-8",
    port: 1237,
    framework: "vllm-mlx",
    color: "#8b5cf6",
  },
  {
    id: "qwen35-35b-mlx",
    name: "Qwen3.5-35B-A3B-mixed-6-8",
    modelId: "/Users/janhilgard/mlx-models/Qwen3.5-35B-A3B-mlx-mixed-6-8",
    port: 1238,
    framework: "vllm-mlx",
    color: "#06b6d4",
  },
  {
    id: "gpt-oss-20b-mlx",
    name: "GPT-OSS-20B-mixed-6-8",
    modelId: "/Users/janhilgard/mlx-models/gpt-oss-20b-mlx-mixed-6-8",
    port: 1235,
    framework: "vllm-mlx",
    color: "#f97316",
  },
  {
    id: "gemma4-26b-mlx",
    name: "Gemma-4-26B-A4B-mixed-6-8",
    modelId: "/Users/janhilgard/mlx-models/gemma-4-26b-a4b-it-mlx-mixed-6-8",
    port: 1236,
    framework: "vllm-mlx",
    color: "#ec4899",
  },
  {
    id: "gemma4-26b-uncensored-mlx",
    name: "Gemma-4-26B-A4B-uncensored-mixed-6-8",
    modelId: "/Users/janhilgard/mlx-models/gemma-4-26b-a4b-it-uncensored-mlx-mixed-6-8",
    port: 1241,
    framework: "vllm-mlx",
    color: "#a855f7",
  },
  {
    id: "rocinante-12b-mlx",
    name: "Rocinante-X-12B-v1-mixed-6-8",
    modelId: "/Users/janhilgard/mlx-models/Rocinante-X-12B-v1-mlx-mixed-6-8",
    port: 1242,
    framework: "vllm-mlx",
    color: "#d97706",
  },
];
