import type { Persona } from "@/lib/types";

const List = ({ items }: { items: string[] }) =>
  items.length ? (
    <ul className="tight">
      {items.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </ul>
  ) : (
    <p className="muted small">None listed</p>
  );

export function PersonaCard({ persona: p }: { persona: Persona }) {
  return (
    <div className="card">
      <div className="spread">
        <h2>{p.name}</h2>
        <div className="row">
          <span className={`badge ${p.status === "validated" ? "ok" : "warn"}`}>{p.status}</span>
          <span className="badge">{p.device}</span>
          <span className="badge">Tech comfort {p.techComfort}/5</span>
          <span className="badge">Patience {p.patience}/5</span>
        </div>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>{p.role}</p>
      <p>{p.summary}</p>
      <div className="grid">
        <div><h3>Goals</h3><List items={p.goals} /></div>
        <div><h3>Frustrations</h3><List items={p.frustrations} /></div>
        <div><h3>Behaviours</h3><List items={p.behaviors} /></div>
        <div>
          <h3>Domain knowledge</h3>
          <p className="small">{p.domainKnowledge}</p>
          <h3>Accessibility needs</h3>
          <List items={p.accessibilityNeeds} />
        </div>
      </div>
      <p className="small muted" style={{ marginBottom: 0 }}>
        Evidence: {p.evidence.length ? p.evidence.map((e) => e.source).join(", ") : "none yet"} · id <code>{p.id}</code>
        {p.owner ? ` · owner ${p.owner}` : ""}
      </p>
    </div>
  );
}
