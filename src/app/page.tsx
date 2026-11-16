import { NewStudyForm } from "@/components/NewStudyForm";
import { config } from "@/lib/config";
import { listPersonas } from "@/lib/personas";
import { listProducts } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { personas, errors: personaErrors } = await listPersonas();
  const { products, errors: productErrors } = await listProducts();
  const errors = [...personaErrors, ...productErrors];
  return (
    <>
      <h1>New study</h1>
      <p className="muted">Pick a product, define a task, choose personas, and watch them try it on the site.</p>
      {errors.length > 0 && (
        <div className="card error small">Some persona or product files could not be loaded: {errors.join(" · ")}</div>
      )}
      <NewStudyForm personas={personas} products={products} extraHosts={config.allowedHosts} />
    </>
  );
}
