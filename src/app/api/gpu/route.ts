import { NextResponse } from "next/server";
import { getGpuMetrics, getSystemMetrics } from "@/lib/gpu-metrics";
import { GpuResponse } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const [gpu, system] = await Promise.all([getGpuMetrics(), getSystemMetrics()]);

  const response: GpuResponse = {
    gpu,
    system,
    timestamp: Date.now(),
  };

  return NextResponse.json(response);
}
