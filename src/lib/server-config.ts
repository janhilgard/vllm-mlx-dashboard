import { ServerConfig } from "@/types";

export const SERVERS: ServerConfig[] = [
  {
    id: "gpt-oss-20b",
    name: "GPT-OSS-20B",
    port: 1235,
    framework: "llama.cpp",
    color: "#22c55e",
  },
  {
    id: "qwen3-vl-8b",
    name: "Qwen3-VL-8B",
    port: 1236,
    framework: "llama.cpp",
    color: "#3b82f6",
  },
  {
    id: "qwen3-next-80b",
    name: "Qwen3-Next-80B",
    port: 1237,
    framework: "llama.cpp",
    color: "#f59e0b",
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
    port: 1240,
    framework: "vllm-mlx",
    color: "#ec4899",
  },
];
