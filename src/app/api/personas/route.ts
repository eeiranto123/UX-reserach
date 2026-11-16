import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { listPersonas } from "@/lib/personas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { personas, errors } = await listPersonas();
  return NextResponse.json({ personas, errors, allowedHosts: config.allowedHosts });
}
