import { ServerConfig } from "@/types";

export const SERVERS: ServerConfig[] = [
  {
    id: "qwen35-122b-mlx",
    name: "Qwen3.5-122B-A10B-4bit",
    modelId: "Qwen3.5-122B-A10B-4bit",
    port: 1237,
    framework: "vllm-mlx",
    color: "#8b5cf6",
  },
  {
    id: "qwen35-35b-mlx",
    name: "Qwen3.5-35B-A3B-4bit",
    modelId: "Qwen3.5-35B-A3B-4bit",
    port: 1238,
    framework: "vllm-mlx",
    color: "#06b6d4",
  },
  {
    id: "gpt-oss-20b-mlx",
    name: "GPT-OSS-20B-MLX",
    modelId: "InferenceIllusionist/gpt-oss-20b-MLX-4bit",
    port: 1235,
    framework: "vllm-mlx",
    color: "#f97316",
  },
];
