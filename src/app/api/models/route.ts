import { NextResponse } from "next/server";
import { chatTargets } from "@/lib/chat-targets";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ targets: await chatTargets() });
}
