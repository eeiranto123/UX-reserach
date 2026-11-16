import { PersonaCard } from "@/components/PersonaCard";
import { listPersonas } from "@/lib/personas";

export const dynamic = "force-dynamic";

export default async function PersonasPage() {
  const { personas, errors } = await listPersonas();
  return (
    <>
      <h1>Persona library</h1>
      <p className="muted">
        Personas are JSON files in the <code>personas/</code> folder of the repository, reviewed through pull requests.
        Draft personas are placeholders until they are grounded in research evidence.
      </p>
      {errors.length > 0 && <div className="card error small">Invalid persona files: {errors.join(" · ")}</div>}
      {personas.map((p) => (
        <PersonaCard key={p.id} persona={p} />
      ))}
    </>
  );
}
