"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_POST_TASK_QUESTIONS, TASK_TEMPLATES, missingFields } from "@/lib/tasks";
import { studyTitle } from "@/lib/title";
import type { Persona, Product } from "@/lib/types";

export function NewStudyForm({
  personas,
  products,
  extraHosts,
  nextRuns,
}: {
  personas: Persona[];
  products: Product[];
  extraHosts: string[];
  nextRuns: Record<string, number>;
}) {
  const router = useRouter();

  // --- Mandatory: product, task type + its fields, personas -----------------
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const product = products.find((p) => p.id === productId);
  const [templateId, setTemplateId] = useState(TASK_TEMPLATES[0].id);
  const template = TASK_TEMPLATES.find((t) => t.id === templateId)!;
  const [fields, setFields] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>(personas.map((p) => p.id));

  // --- Optional overrides ("Advanced options") ------------------------------
  const [targetUrl, setTargetUrl] = useState(products[0]?.defaultUrl ?? "");
  const [scenarioOverride, setScenarioOverride] = useState<string | null>(null);
  const [successOverride, setSuccessOverride] = useState<string | null>(null);
  const [participantContext, setParticipantContext] = useState("");
  const [questions, setQuestions] = useState(DEFAULT_POST_TASK_QUESTIONS.join("\n"));
  const [runsPerPersona, setRunsPerPersona] = useState(1);
  const [maxSteps, setMaxSteps] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Name preview; the date comes from the user's clock, so render after mount.
  const [title, setTitle] = useState("");
  useEffect(() => {
    setTitle(product ? studyTitle(product, nextRuns[product.id] ?? 1) : "");
  }, [product, nextRuns]);

  const built = useMemo(() => template.build(fields), [template, fields]);
  const missing = missingFields(template, fields);
  const scenario = scenarioOverride ?? built.scenario;
  const successCriteria = successOverride ?? built.successCriteria;
  const allowedHosts = [...(product?.allowedHosts ?? []), ...extraHosts];
  const sessionCount = selected.length * runsPerPersona;
  const ready = Boolean(product) && missing.length === 0 && selected.length > 0;

  const changeProduct = (id: string) => {
    setProductId(id);
    const next = products.find((p) => p.id === id);
    if (next) setTargetUrl(next.defaultUrl);
  };
  const changeTemplate = (id: string) => {
    setTemplateId(id);
    setScenarioOverride(null);
    setSuccessOverride(null);
    setMaxSteps(null);
  };
  const setField = (key: string, value: string) => setFields((f) => ({ ...f, [key]: value }));
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const defaults = DEFAULT_POST_TASK_QUESTIONS.join("\n");
      const res = await fetch("/api/studies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          task: { templateId, fields: Object.fromEntries(template.fields.map((f) => [f.key, fields[f.key] ?? ""])) },
          personaIds: selected,
          // Only send what was actually changed; the server fills in defaults.
          ...(product && targetUrl !== product.defaultUrl ? { targetUrl } : {}),
          ...(scenarioOverride !== null ? { scenario: scenarioOverride } : {}),
          ...(successOverride !== null ? { successCriteria: successOverride } : {}),
          ...(participantContext.trim() ? { participantContext } : {}),
          ...(questions !== defaults
            ? { postTaskQuestions: questions.split("\n").map((q) => q.trim()).filter(Boolean) }
            : {}),
          ...(runsPerPersona !== 1 ? { runsPerPersona } : {}),
          ...(maxSteps !== null ? { maxSteps } : {}),
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
      {/* 1. Product ------------------------------------------------------- */}
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
            <span className="label">Study name</span>
            <div className="readonly">{title || " "}</div>
            <small className="hint">Set automatically: date + product + &ldquo;synthetic testing&rdquo; + test number for the day.</small>
          </div>
        </div>
        {product?.environment === "live" && (
          <div className="banner" style={{ margin: 0 }}>
            <strong>Live site.</strong> Personas won&apos;t order, pay, register or submit personal details, and
            checkout/payment pages are blocked. Synthetic visits may show up in analytics.
          </div>
        )}
      </div>

      {/* 2. Task ---------------------------------------------------------- */}
      <div className="card">
        <h2>2. Task</h2>
        <div className="task-types" role="radiogroup" aria-label="Task type">
          {TASK_TEMPLATES.map((t) => (
            <label key={t.id} className={`task-type ${t.id === templateId ? "selected" : ""}`}>
              <input type="radio" name="taskType" value={t.id} checked={t.id === templateId}
                onChange={() => changeTemplate(t.id)} />
              <strong>{t.label}</strong>
              <span className="small muted">{t.description}</span>
            </label>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          {template.fields.map((f) => (
            <label key={`${template.id}-${f.key}`} className="field">
              <span>
                {f.label} {f.required ? <span className="req">*</span> : <span className="muted small">(optional)</span>}
              </span>
              {f.multiline ? (
                <textarea value={fields[f.key] ?? ""} placeholder={f.placeholder} required={f.required}
                  onChange={(e) => setField(f.key, e.target.value)} />
              ) : (
                <input type="text" value={fields[f.key] ?? ""} placeholder={f.placeholder} required={f.required}
                  onChange={(e) => setField(f.key, e.target.value)} />
              )}
              {f.help && <small>{f.help}</small>}
            </label>
          ))}
        </div>

        {template.id !== "custom" && (
          <div className="preview">
            <div className="spread">
              <span className="label">What the participant will be told</span>
              {scenarioOverride === null ? (
                <button type="button" className="link" onClick={() => setScenarioOverride(built.scenario)}>Edit wording</button>
              ) : (
                <button type="button" className="link" onClick={() => setScenarioOverride(null)}>Reset to template</button>
              )}
            </div>
            {scenarioOverride === null ? (
              <p className={missing.length ? "muted" : ""} style={{ margin: "4px 0 0" }}>
                {missing.length ? `Fill in: ${missing.map((f) => f.label.replace(/\?$/, "")).join(", ")}` : scenario}
              </p>
            ) : (
              <textarea value={scenarioOverride} onChange={(e) => setScenarioOverride(e.target.value)} />
            )}
          </div>
        )}
      </div>

      {/* 3. Participants -------------------------------------------------- */}
      <div className="card">
        <h2>3. Who tests it</h2>
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
                <div className="row small" style={{ marginTop: 8 }}>
                  <span className="badge">{p.device}</span>
                  <span className="badge">Tech {p.techComfort}/5</span>
                  <span className="badge">Patience {p.patience}/5</span>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Advanced --------------------------------------------------------- */}
      <details className="card advanced">
        <summary>Advanced options <span className="muted small">(optional - sensible defaults are set)</span></summary>
        <div style={{ marginTop: 14 }}>
          <label className="field">
            <span>Starting URL</span>
            <input type="url" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} />
            <small>Allowed hosts for {product?.name ?? "this product"}: {allowedHosts.join(", ") || "none"}</small>
          </label>
          <label className="field">
            <span>Success criteria (hidden from the participant)</span>
            <textarea value={successCriteria} onChange={(e) => setSuccessOverride(e.target.value)} />
            <small>
              Generated from the task. Used by a separate evaluator to judge each session.
              {successOverride !== null && (
                <> <button type="button" className="link" onClick={() => setSuccessOverride(null)}>Reset</button></>
              )}
            </small>
          </label>
          <label className="field">
            <span>Extra information for the participant</span>
            <input type="text" value={participantContext} onChange={(e) => setParticipantContext(e.target.value)}
              placeholder="e.g. Your budget is about 200 €." />
            <small>Never include real customer data or real credentials.</small>
          </label>
          <label className="field">
            <span>Post-task questions (one per line)</span>
            <textarea value={questions} onChange={(e) => setQuestions(e.target.value)} />
          </label>
          <div className="row">
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
              <input type="number" min={5} max={60} value={maxSteps ?? template.maxSteps}
                onChange={(e) => setMaxSteps(Number(e.target.value))} />
              <small>Default for this task type: {template.maxSteps}.</small>
            </label>
          </div>
        </div>
      </details>

      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit" disabled={submitting || !ready}>
          {submitting ? "Starting…" : `Run study (${sessionCount} session${sessionCount === 1 ? "" : "s"})`}
        </button>
        {!ready && !submitting && (
          <span className="small muted">
            {missing.length > 0
              ? "Fill in the required task fields."
              : selected.length === 0
                ? "Choose at least one persona."
                : ""}
          </span>
        )}
      </div>
    </form>
  );
}
