import { NewStudyForm } from "@/components/NewStudyForm";
import { config } from "@/lib/config";
import { listPersonas } from "@/lib/personas";
import { listProducts } from "@/lib/products";
import { nextRunNumber, recoverInterrupted } from "@/lib/runner";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { personas, errors: personaErrors } = await listPersonas();
  const { products, errors: productErrors } = await listProducts();
  const errors = [...personaErrors, ...productErrors];
  await recoverInterrupted();
  // Preview of the run number in the study name; the final number is assigned on submit.
  const nextRuns: Record<string, number> = {};
  for (const p of products) nextRuns[p.id] = await nextRunNumber(p);
  return (
    <>
      <h1>New study</h1>
      <p className="muted">Pick a product and a task, fill in what the shopper is looking for, and choose who tests it.</p>
      {errors.length > 0 && (
        <div className="card error small">Some persona or product files could not be loaded: {errors.join(" · ")}</div>
      )}
      <NewStudyForm personas={personas} products={products} extraHosts={config.allowedHosts} nextRuns={nextRuns} />
    </>
  );
}
