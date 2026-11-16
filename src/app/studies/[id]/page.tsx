import { notFound } from "next/navigation";
import { StudyView } from "@/components/StudyView";
import { recoverInterrupted } from "@/lib/runner";
import { loadStudy } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function StudyPage({ params }: { params: Promise<{ id: string }> }) {
  await recoverInterrupted();
  const { id } = await params;
  const study = /^[a-zA-Z0-9_-]+$/.test(id) ? await loadStudy(id) : undefined;
  if (!study) notFound();
  return <StudyView initial={study} />;
}
