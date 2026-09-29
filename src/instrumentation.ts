/**
 * Runs once when the Next.js server starts. Starts the load-history sampler
 * (Node runtime only — it shells out to iostat/powermetrics and writes files).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSampler } = await import("./lib/sampler");
    startSampler();
  }
}
