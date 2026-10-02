import { ServerConfig } from "@/types";

export const SERVERS: ServerConfig[] = [
  // ---- Všechny Splash instance běží od 2. 10. 2026 z buildu worktree ~/splash-flashnext ----
  // (hlásí /status active_requests); návrat na brew 1.1.0: ~/splash-bench/*.bak-brew.
  // ---- Splash (DFlash2), od 29. 9. 2026 primární engine pro Qwen3.6-35B ----
  // LaunchAgent ai.inco.splash, ~/splash-bench/splash-start.sh. Vyžaduje
  // bearer token: SPLASH_API_KEY v .env.local (čte se jen na serveru).
  {
    id: "splash",
    name: "Splash · Qwen3.6-35B-A3B",
    modelId: "unsloth/Qwen3.6-35B-A3B-GGUF:UD-Q4_K_XL",
    port: 8001,
    framework: "splash",
    color: "#22c55e",
    apiKeyEnv: "SPLASH_API_KEY",
    role: "primární 35B pro produkci crawlu",
  },
  // ---- Splash 27B (:8002): VYPNUTO 2. 10. 2026 (rozhodnutí uživatele: 27B opuštěn) ----
  // Druhý soudce, silný model i zálohu převzal Flash-Next (:8003). LaunchAgent
  // ~/Library/LaunchAgents/ai.inco.splash27b.plist.vypnuto-20261002; obnovení = odkomentovat.
  // {
  //   id: "splash27b",
  //   name: "Splash · Qwen3.8-27B",
  //   modelId: "unsloth/Qwen3.8-27B-GGUF:UD-Q4_K_XL",
  //   port: 8002,
  //   framework: "splash",
  //   color: "#06b6d4",
  //   apiKeyEnv: "SPLASH_API_KEY",
  //   role: "druhý soudce párů (veto před vydáním páru bez EANu)",
  // },
  // ---- Splash Flash-Next, od 2. 10. 2026: Qwen3.8-Flash-Next s MTP, text + obrázky ----
  // LaunchAgent ai.inco.splashflashnext, ~/splash-bench/splash-flashnext-start.sh,
  // build z worktree ~/splash-flashnext (PR incoai/splash#253). Potřebuje ~118 GB.
  {
    id: "splashflashnext",
    name: "Splash · Qwen3.8-Flash-Next",
    modelId: "unsloth/Qwen3.8-Flash-Next-GGUF:UD-Q4_K_XL",
    port: 8003,
    framework: "splash",
    color: "#a855f7",
    apiKeyEnv: "SPLASH_API_KEY",
    role: "druhý soudce, silný model codegenu a záloha za 35B (od 2. 10. 2026)",
  },
  // ---- oMLX: z monitoringu vyřazen 30. 9. 2026 (pokyn uživatele) ----
  // Nepoužívá se — zálohou i silným modelem je od 2. 10. Splash Flash-Next (:8003).
  // Obnovení = odkomentovat; karta, sampler i chat oMLX dál umí.
  // {
  //   id: "omlx",
  //   name: "oMLX",
  //   modelId: "Qwen3.6-35B-A3B-UD-MLX-4bit",
  //   port: 8000,
  //   framework: "omlx",
  //   color: "#f59e0b",
  //   role: "nepoužívá se — zálohou i silným modelem je od 30. 9. Splash 27B",
  // },

  // ---- Qwen3.6-35B / port 1237: služba zastavena 2026-08-19 (přechod na oMLX) ----
  // Konfigurace ponechána; obnovení = odkomentovat + plutil RunAtLoad true + launchctl load
  // {
  // id: "qwen36-mlx",
  // name: "Qwen3.6-35B-A3B",
  // modelId: "qwen3.6-35b",
  // port: 1237,
  // framework: "vllm-mlx",
  // color: "#8b5cf6",
  // },

  // ---- Qwen3.8-27B / port 1236: služba zastavena 2026-08-17 na pokyn ----
  // Konfigurace ponechána beze změny; obnovení = odkomentovat a
  // launchctl load ~/Library/LaunchAgents/com.qwen38-27b-mlx.server.plist
  // {
  // id: "qwen38-27b-mlx",
  // name: "Qwen3.8-27B-MTP",
  // modelId: "qwen3.8-27b",
  // port: 1236,
  // framework: "vllm-mlx",
  // color: "#06b6d4",
  // },

];
