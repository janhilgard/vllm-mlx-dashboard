import { NextResponse } from "next/server";
import { getGpuMetrics } from "@/lib/gpu-metrics";
import { GpuResponse } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const gpu = await getGpuMetrics();

  const response: GpuResponse = {
    gpu,
    timestamp: Date.now(),
  };

  return NextResponse.json(response);
}
