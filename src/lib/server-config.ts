import { ServerConfig } from "@/types";

export const SERVERS: ServerConfig[] = [
  {
    id: "qwen3-next-80b-a3b-mlx",
    name: "Qwen3-Next-80B-A3B-MLX",
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
    port: 1236,
    framework: "vllm-mlx",
    color: "#06b6d4",
  },
];
