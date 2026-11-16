import { NextResponse } from "next/server";
import { isAllowedUrl } from "@/lib/config";
import { getProduct, urlPolicy } from "@/lib/products";
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
      product: s.product?.name,
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
  const product = await getProduct(parsed.data.productId);
  if (!product) {
    return NextResponse.json({ error: `Unknown product: ${parsed.data.productId}` }, { status: 400 });
  }
  const policy = urlPolicy(product);
  if (!isAllowedUrl(parsed.data.targetUrl, policy)) {
    return NextResponse.json(
      { error: `The starting URL is not allowed for ${product.name}. Allowed hosts: ${policy.allowedHosts.join(", ")}` },
      { status: 400 },
    );
  }
  try {
    // Identity header set by the SSO proxy in front of the app (see README).
    const createdBy = req.headers.get("x-forwarded-email") ?? req.headers.get("x-forwarded-user") ?? undefined;
    const study = await createStudy(parsed.data, product, createdBy);
    return NextResponse.json({ id: study.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
