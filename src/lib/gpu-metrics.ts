import { exec } from "child_process";
import { GpuMetrics } from "@/types";

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
