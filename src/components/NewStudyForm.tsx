"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { studyTitle } from "@/lib/title";
import type { Persona, Product } from "@/lib/types";

export function NewStudyForm({
  personas,
  products,
  extraHosts,
}: {
  personas: Persona[];
  products: Product[];
  extraHosts: string[];
}) {
  const router = useRouter();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const product = products.find((p) => p.id === productId);
  const [targetUrl, setTargetUrl] = useState(products[0]?.defaultUrl ?? "");
  // Filled in after mount so the date comes from the user's clock, not the server render.
  const [title, setTitle] = useState("");
  useEffect(() => {
    setTitle(product ? studyTitle(product) : "");
  }, [product]);
  const allowedHosts = [...(product?.allowedHosts ?? []), ...extraHosts];

  const changeProduct = (id: string) => {
    setProductId(id);
    const next = products.find((p) => p.id === id);
    if (next) setTargetUrl(next.defaultUrl);
  };
  const [scenario, setScenario] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");
  const [participantContext, setParticipantContext] = useState("");
  const [questions, setQuestions] = useState(
    "How easy or difficult was this task, and why?\nWas anything confusing or unexpected?",
  );
  const [selected, setSelected] = useState<string[]>(personas.length === 1 ? [personas[0].id] : []);
  const [runsPerPersona, setRunsPerPersona] = useState(1);
  const [maxSteps, setMaxSteps] = useState(25);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const sessionCount = selected.length * runsPerPersona;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/studies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          targetType: "url",
          targetUrl,
          scenario,
          successCriteria,
          participantContext,
          postTaskQuestions: questions.split("\n").map((q) => q.trim()).filter(Boolean),
          personaIds: selected,
          runsPerPersona,
          maxSteps,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not start the study");
      router.push(`/studies/${body.id}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="card">
        <h2>1. Product</h2>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <label className="field" style={{ flex: "1 1 240px" }}>
            <span>Product being tested</span>
            <select value={productId} onChange={(e) => changeProduct(e.target.value)} required>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {products.length === 0 && <small className="error">No products configured. Add one to the products/ folder.</small>}
          </label>
          <div className="field" style={{ flex: "2 1 320px" }}>
            <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Study name</span>
            <div className="readonly">{title || "\u00a0"}</div>
            <small className="muted" style={{ display: "block", marginTop: 3, fontSize: 12.5 }}>
              Set automatically: date + product + &ldquo;synthetic testing&rdquo;.
            </small>
          </div>
        </div>
        {product?.environment === "live" && (
          <div className="banner" style={{ marginBottom: 14 }}>
            <strong>Live site.</strong> Sessions run against the public {product.name} website. Personas are instructed not to
            order, pay, register or submit personal details, and checkout/payment URLs are blocked. Synthetic visits may
            show up in the site&apos;s analytics.
          </div>
        )}
        <label className="field">
          <span>Starting URL</span>
          <input type="url" required value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} />
          <small>Allowed hosts for {product?.name ?? "this product"}: {allowedHosts.join(", ") || "none"}</small>
        </label>
      </div>

      <div className="card">
        <h2>2. Task</h2>
        <label className="field">
          <span>Scenario (read to the participant)</span>
          <textarea required value={scenario} onChange={(e) => setScenario(e.target.value)}
            placeholder="You're renovating your bathroom and need waterproofing for the floor. Find a suitable product and check whether it's available at a store near you." />
          <small>Write it like a real usability test: describe the goal, not the clicks.</small>
        </label>
        <label className="field">
          <span>Success criteria (hidden from the participant)</span>
          <textarea value={successCriteria} onChange={(e) => setSuccessCriteria(e.target.value)}
            placeholder="A waterproofing product page is open and store availability has been checked." />
          <small>Used by a separate evaluator to judge whether each session succeeded.</small>
        </label>
        <label className="field">
          <span>Information for the participant (optional)</span>
          <textarea value={participantContext} onChange={(e) => setParticipantContext(e.target.value)}
            placeholder="e.g. You live in Tampere." />
          <small>Never include real customer data or real credentials.</small>
        </label>
        <label className="field">
          <span>Post-task questions (one per line)</span>
          <textarea value={questions} onChange={(e) => setQuestions(e.target.value)} />
        </label>
      </div>

      <div className="card">
        <h2>3. Participants</h2>
        {personas.length === 0 ? (
          <p className="muted">No personas found. Add JSON files to the <code>personas/</code> folder.</p>
        ) : (
          <div className="grid">
            {personas.map((p) => (
              <label key={p.id} className={`persona-pick ${selected.includes(p.id) ? "selected" : ""}`}>
                <div className="spread">
                  <strong>
                    <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
                    {p.name}
                  </strong>
                  <span className={`badge ${p.status === "validated" ? "ok" : "warn"}`}>{p.status}</span>
                </div>
                <div className="small muted">{p.role}</div>
                <div className="small" style={{ marginTop: 6 }}>{p.summary}</div>
                <div className="row small" style={{ marginTop: 8 }}>
                  <span className="badge">{p.device}</span>
                  <span className="badge">Tech {p.techComfort}/5</span>
                  <span className="badge">Patience {p.patience}/5</span>
                </div>
              </label>
            ))}
          </div>
        )}
        <div className="row" style={{ marginTop: 16 }}>
          <label className="field" style={{ flex: "1 1 200px" }}>
            <span>Runs per persona</span>
            <select value={runsPerPersona} onChange={(e) => setRunsPerPersona(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <small>Several runs show whether an issue is consistent or a one-off.</small>
          </label>
          <label className="field" style={{ flex: "1 1 200px" }}>
            <span>Max actions per session</span>
            <input type="number" min={5} max={60} value={maxSteps}
              onChange={(e) => setMaxSteps(Number(e.target.value))} />
            <small>The participant is asked to wrap up when this runs out.</small>
          </label>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit" disabled={submitting || selected.length === 0 || !product}>
          {submitting ? "Starting…" : `Run study (${sessionCount} session${sessionCount === 1 ? "" : "s"})`}
        </button>
      </div>
    </form>
  );
}
