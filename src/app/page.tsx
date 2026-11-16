import { NewStudyForm } from "@/components/NewStudyForm";
import { config } from "@/lib/config";
import { listPersonas } from "@/lib/personas";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { personas, errors } = await listPersonas();
  return (
    <>
      <h1>New study</h1>
      <p className="muted">Define a task, pick personas, and watch them try it on a staging site.</p>
      {errors.length > 0 && (
        <div className="card error small">Some persona files could not be loaded: {errors.join(" · ")}</div>
      )}
      <NewStudyForm personas={personas} allowedHosts={config.allowedHosts} />
    </>
  );
}
