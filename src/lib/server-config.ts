import { ServerConfig } from "@/types";

export const SERVERS: ServerConfig[] = [
  {
    id: "qwen3-vl-8b",
    name: "Qwen3-VL-8B",
    port: 1236,
    framework: "llama.cpp",
    color: "#3b82f6",
  },
  {
    id: "qwen3-30b",
    name: "Qwen3-30B",
    port: 1238,
    framework: "llama.cpp",
    color: "#a855f7",
  },
  {
    id: "qwen3-next-80b-mlx",
    name: "Qwen3-Next-80B-MLX",
    port: 1239,
    framework: "vllm-mlx",
    color: "#ef4444",
  },
  {
    id: "gpt-oss-20b-mlx",
    name: "GPT-OSS-20B-MLX",
    port: 1235,
    framework: "vllm-mlx",
    color: "#f97316",
  },
  {
    id: "qwen3-vl-8b-mlx",
    name: "Qwen3-VL-8B-MLX",
    port: 1241,
    framework: "vllm-mlx",
    color: "#06b6d4",
  },
];
