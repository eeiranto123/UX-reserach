"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Persona } from "@/lib/types";

export function NewStudyForm({ personas, allowedHosts }: { personas: Persona[]; allowedHosts: string[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [targetUrl, setTargetUrl] = useState(allowedHosts[0] ? `https://${allowedHosts[0]}/` : "");
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
          title,
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
        <h2>1. Task</h2>
        <label className="field">
          <span>Study title</span>
          <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Switch to annual billing" />
        </label>
        <label className="field">
          <span>Starting URL</span>
          <input type="url" required value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} />
          <small>
            Staging sites only. Allowed hosts: {allowedHosts.length ? allowedHosts.join(", ") : "none configured (set ALLOWED_TARGET_HOSTS)"}
          </small>
        </label>
        <label className="field">
          <span>Scenario (read to the participant)</span>
          <textarea required value={scenario} onChange={(e) => setScenario(e.target.value)}
            placeholder="You're paying monthly for your team's plan and your manager asked you to switch to yearly billing to save money. Make the change." />
          <small>Write it like a real usability test: describe the goal, not the clicks.</small>
        </label>
        <label className="field">
          <span>Success criteria (hidden from the participant)</span>
          <textarea value={successCriteria} onChange={(e) => setSuccessCriteria(e.target.value)}
            placeholder="The billing page shows 'Annual' as the selected plan, or the confirmation screen for the change is reached." />
          <small>Used by a separate evaluator to judge whether each session succeeded.</small>
        </label>
        <label className="field">
          <span>Information for the participant (optional)</span>
          <textarea value={participantContext} onChange={(e) => setParticipantContext(e.target.value)}
            placeholder="Test login: ux-test-1@example.com / (staging test password)" />
          <small>Only use staging test accounts. Never enter real customer or personal data.</small>
        </label>
        <label className="field">
          <span>Post-task questions (one per line)</span>
          <textarea value={questions} onChange={(e) => setQuestions(e.target.value)} />
        </label>
      </div>

      <div className="card">
        <h2>2. Participants</h2>
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
        <button type="submit" disabled={submitting || selected.length === 0}>
          {submitting ? "Starting…" : `Run study (${sessionCount} session${sessionCount === 1 ? "" : "s"})`}
        </button>
      </div>
    </form>
  );
}
