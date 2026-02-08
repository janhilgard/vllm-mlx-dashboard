import { NextResponse } from "next/server";
import { SERVERS } from "@/lib/server-config";
import { fetchServerStatus } from "@/lib/fetchers";
import { ServersResponse } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const servers = await Promise.all(SERVERS.map(fetchServerStatus));

  const response: ServersResponse = {
    servers,
    timestamp: Date.now(),
  };

  return NextResponse.json(response);
}
