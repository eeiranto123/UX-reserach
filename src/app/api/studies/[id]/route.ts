import { NextResponse } from "next/server";
import { recoverInterrupted } from "@/lib/runner";
import { loadStudy } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await recoverInterrupted();
  const { id } = await params;
  const study = /^[a-zA-Z0-9_-]+$/.test(id) ? await loadStudy(id) : undefined;
  if (!study) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(study);
}
