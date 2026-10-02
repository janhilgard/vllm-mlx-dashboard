import { exec } from "child_process";
import type { GpuMetrics, ProcessInfo, SystemMetrics } from "@/types";

export async function getGpuMetrics(): Promise<GpuMetrics> {
  const password = process.env.SUDO_PASSWORD;
  if (!password) {
    return { gpu_utilization_percent: null, gpu_power_watts: null };
  }

  try {
    const output = await new Promise<string>((resolve, reject) => {
      const child = exec(
        "sudo -S powermetrics --samplers gpu_power -i 1000 -n 1",
        { timeout: 5000 },
        (error, stdout, stderr) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(stdout + stderr);
        }
      );
      // Provide password via stdin
      child.stdin?.write(password + "\n");
      child.stdin?.end();
    });

    return parsePowermetricsOutput(output);
  } catch {
    return { gpu_utilization_percent: null, gpu_power_watts: null };
  }
}

function parsePowermetricsOutput(output: string): GpuMetrics {
  let gpuUtilization: number | null = null;
  let gpuPower: number | null = null;

  for (const line of output.split("\n")) {
    // GPU HW active residency: 45.12%
    const utilizationMatch = line.match(/GPU HW active residency:\s+([\d.]+)%/);
    if (utilizationMatch) {
      gpuUtilization = parseFloat(utilizationMatch[1]);
    }

    // GPU Power: 12.34 mW  or  GPU Power: 5678 mW
    const powerMatch = line.match(/GPU Power:\s+([\d.]+)\s*mW/);
    if (powerMatch) {
      gpuPower = parseFloat(powerMatch[1]) / 1000; // Convert mW to W
    }
  }

  return {
    gpu_utilization_percent: gpuUtilization,
    gpu_power_watts: gpuPower,
  };
}

/* ------------------------- System (macOS) ------------------------- */


/** Fixed commands only — nothing from the request ever reaches the shell. */
function run(cmd: string, timeout = 4000): Promise<string> {
  return new Promise((resolve) => {
    exec(cmd, { timeout, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => resolve(error ? "" : stdout));
  });
}

/** Processes worth watching on the AI server, matched by command line. */
const WATCHED: Array<[string, RegExp]> = [
  ["oMLX", /omlx-server|oMLX\.app\/Contents\/MacOS\/oMLX/],
  ["Splash engine", /splash serve-native/],
  ["Splash server", /splash[\w-]*\/.*server\/server\.py/],
  ["monitoring", /next-server|next start/],
];

function parseSize(v: string): number {
  const m = v.match(/([\d.]+)([KMG])/);
  if (!m) return 0;
  return parseFloat(m[1]) * { K: 1024, M: 1024 ** 2, G: 1024 ** 3 }[m[2] as "K" | "M" | "G"];
}

export async function getSystemMetrics(): Promise<SystemMetrics | undefined> {
  const [sys, vm, ps] = await Promise.all([
    run("sysctl -n hw.memsize hw.ncpu vm.loadavg vm.swapusage"),
    run("vm_stat"),
    run("ps -axww -o pid=,pcpu=,rss=,command="),
  ]);
  if (!sys) return undefined;
  const lines = sys.trim().split("\n");
  const total = Number(lines[0]) || 0;
  const cpus = Number(lines[1]) || 0;
  const load = (lines[2] ?? "").replace(/[{}]/g, "").trim().split(/\s+/).map(Number);
  const swap = lines[3] ?? "";
  const swapTotal = parseSize(swap.match(/total = ([\d.]+[KMG])/)?.[1] ?? "");
  const swapUsed = parseSize(swap.match(/used = ([\d.]+[KMG])/)?.[1] ?? "");

  const pageSize = Number(vm.match(/page size of (\d+) bytes/)?.[1] ?? 16384);
  const pages = (label: string) => Number(vm.match(new RegExp(`${label}:\\s+(\\d+)`))?.[1] ?? 0) * pageSize;
  const wired = pages("Pages wired down");
  const active = pages("Pages active");
  const compressed = pages("Pages occupied by compressor");
  const cached = pages("File-backed pages");
  const anonymous = pages("Anonymous pages");
  // Activity Monitor's "Memory Used" = app (anonymous − purgeable) + wired + compressed.
  const purgeable = pages("Pages purgeable");
  const used = Math.max(0, anonymous - purgeable) + wired + compressed || active + wired + compressed;

  const processes: ProcessInfo[] = [];
  for (const line of ps.split("\n")) {
    const m = line.trim().match(/^(\d+)\s+([\d.]+)\s+(\d+)\s+(.*)$/);
    if (!m) continue;
    const hit = WATCHED.find(([, re]) => re.test(m[4]));
    if (!hit) continue;
    processes.push({ name: hit[0], pid: Number(m[1]), cpu_percent: Number(m[2]), rss_bytes: Number(m[3]) * 1024 });
  }
  processes.sort((a, b) => b.rss_bytes - a.rss_bytes);

  return {
    memory_total_bytes: total,
    memory_used_bytes: used,
    memory_wired_bytes: wired,
    memory_compressed_bytes: compressed,
    memory_cached_bytes: cached,
    swap_used_bytes: swapUsed,
    swap_total_bytes: swapTotal,
    load: [load[0] || 0, load[1] || 0, load[2] || 0],
    cpu_count: cpus,
    processes,
  };
}
