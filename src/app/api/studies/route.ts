import { NextResponse } from "next/server";
import { config, isAllowedUrl } from "@/lib/config";
import { createStudy, recoverInterrupted } from "@/lib/runner";
import { listStudies } from "@/lib/store";
import { StudyInputSchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await recoverInterrupted();
  const studies = await listStudies();
  return NextResponse.json(
    studies.map((s) => ({
      id: s.id,
      title: s.input.title,
      targetUrl: s.input.targetUrl,
      status: s.status,
      createdAt: s.createdAt,
      createdBy: s.createdBy,
      sessions: s.sessions.length,
      completed: s.sessions.filter((x) => x.status === "completed").length,
    })),
  );
}

export async function POST(req: Request) {
  await recoverInterrupted();
  const parsed = StudyInputSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") },
      { status: 400 },
    );
  }
  if (!isAllowedUrl(parsed.data.targetUrl)) {
    return NextResponse.json(
      {
        error: `Target host is not allowed. Allowed test hosts: ${config.allowedHosts.join(", ") || "(none configured - set ALLOWED_TARGET_HOSTS)"}`,
      },
      { status: 400 },
    );
  }
  try {
    // Identity header set by the SSO proxy in front of the app (see README).
    const createdBy = req.headers.get("x-forwarded-email") ?? req.headers.get("x-forwarded-user") ?? undefined;
    const study = await createStudy(parsed.data, createdBy);
    return NextResponse.json({ id: study.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
