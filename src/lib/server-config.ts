import { ServerConfig } from "@/types";

export const SERVERS: ServerConfig[] = [
  {
    id: "qwen36-mlx",
    name: "Qwen3.6-35B-A3B",
    modelId: "qwen3.6-35b",
    port: 1237,
    framework: "vllm-mlx",
    color: "#8b5cf6",
  },
  {
    id: "qwen36-27b-mlx",
    name: "Qwen3.6-27B",
    modelId: "qwen3.6-27b",
    port: 1236,
    framework: "vllm-mlx",
    color: "#06b6d4",
  },
];
