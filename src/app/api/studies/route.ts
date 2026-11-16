import { NextResponse } from "next/server";
import { isAllowedUrl } from "@/lib/config";
import { getProduct, urlPolicy } from "@/lib/products";
import { createStudy, recoverInterrupted } from "@/lib/runner";
import { listStudies } from "@/lib/store";
import { DEFAULT_POST_TASK_QUESTIONS, getTaskTemplate, missingFields } from "@/lib/tasks";
import { StudyRequestSchema, type StudyInput } from "@/lib/types";

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
  const parsed = StudyRequestSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") },
      { status: 400 },
    );
  }
  const request = parsed.data;
  const product = await getProduct(request.productId);
  if (!product) {
    return NextResponse.json({ error: `Unknown product: ${request.productId}` }, { status: 400 });
  }
  const template = getTaskTemplate(request.task.templateId);
  if (!template) {
    return NextResponse.json({ error: `Unknown task type: ${request.task.templateId}` }, { status: 400 });
  }
  const missing = missingFields(template, request.task.fields);
  if (missing.length) {
    return NextResponse.json({ error: `Please fill in: ${missing.map((f) => f.label).join(", ")}` }, { status: 400 });
  }

  // Fill everything the user didn't override from the template and product defaults.
  const built = template.build(request.task.fields);
  const input: StudyInput = {
    productId: product.id,
    title: "",
    task: request.task,
    targetType: "url",
    targetUrl: request.targetUrl || product.defaultUrl,
    scenario: request.scenario?.trim() || built.scenario,
    successCriteria: request.successCriteria?.trim() || built.successCriteria,
    participantContext: request.participantContext?.trim() ?? "",
    postTaskQuestions: request.postTaskQuestions ?? DEFAULT_POST_TASK_QUESTIONS,
    personaIds: request.personaIds,
    runsPerPersona: request.runsPerPersona ?? 1,
    maxSteps: request.maxSteps ?? template.maxSteps,
  };
  if (!input.scenario) {
    return NextResponse.json({ error: "The task needs a scenario." }, { status: 400 });
  }

  const policy = urlPolicy(product);
  if (!isAllowedUrl(input.targetUrl, policy)) {
    return NextResponse.json(
      { error: `The starting URL is not allowed for ${product.name}. Allowed hosts: ${policy.allowedHosts.join(", ")}` },
      { status: 400 },
    );
  }
  try {
    // Identity header set by the SSO proxy in front of the app (see README).
    const createdBy = req.headers.get("x-forwarded-email") ?? req.headers.get("x-forwarded-user") ?? undefined;
    const study = await createStudy(input, product, createdBy);
    return NextResponse.json({ id: study.id, title: study.input.title }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
