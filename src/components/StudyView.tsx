"use client";

import { useEffect, useState } from "react";
import type { Session, Study } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

const ACTIVE = ["queued", "running", "synthesizing"];

export function StudyView({ initial }: { initial: Study }) {
  const [study, setStudy] = useState(initial);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!ACTIVE.includes(study.status)) return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/studies/${study.id}`, { cache: "no-store" });
      if (res.ok) setStudy(await res.json());
    }, 3000);
    return () => clearInterval(t);
  }, [study.id, study.status]);

  const done = study.sessions.filter((s) => s.status === "completed");
  const succeeded = done.filter((s) => s.evaluation?.success === "success").length;
  const ease = done.map((s) => s.debrief?.easeRating).filter((x): x is number => typeof x === "number");
  const avgEase = ease.length ? (ease.reduce((a, b) => a + b, 0) / ease.length).toFixed(1) : "–";
  const avgSteps = done.length
    ? (done.reduce((a, s) => a + Math.max(0, s.steps.length - 1), 0) / done.length).toFixed(1)
    : "–";
  const tokens = study.sessions.reduce((a, s) => a + s.usage.inputTokens + s.usage.outputTokens, 0);
  const shot = (file: string) => `/api/studies/${study.id}/screenshots/${file}`;

  return (
    <>
      <div className="spread">
        <h1>{study.input.title}</h1>
        <StatusBadge status={study.status} />
      </div>
      <p className="muted small">
        <a href={study.input.targetUrl} target="_blank" rel="noreferrer">{study.input.targetUrl}</a> · created{" "}
        {new Date(study.createdAt).toLocaleString()}
        {study.createdBy ? ` by ${study.createdBy}` : ""}
      </p>

      <div className="card">
        <h3>Scenario</h3>
        <p style={{ marginTop: 0 }}>{study.input.scenario}</p>
        {study.input.successCriteria && (
          <p className="small muted" style={{ marginBottom: 0 }}>Success criteria: {study.input.successCriteria}</p>
        )}
      </div>

      <div className="stats">
        <Stat v={`${done.length}/${study.sessions.length}`} l="Sessions finished" />
        <Stat v={done.length ? `${succeeded}/${done.length}` : "–"} l="Task success (evaluator)" />
        <Stat v={avgEase} l="Avg. ease (1–7)" />
        <Stat v={avgSteps} l="Avg. actions" />
        <Stat v={tokens ? `${Math.round(tokens / 1000)}k` : "–"} l="Tokens used" />
      </div>

      {study.synthesis ? (
        <div className="card">
          <h2>Synthesis</h2>
          <p><strong>{study.synthesis.headline}</strong></p>
          {study.synthesis.keyFindings.map((f, i) => (
            <div key={i} className={`finding ${f.severity}`}>
              <div className="row">
                <strong>{f.title}</strong>
                <StatusBadge status={f.severity === "high" ? "failed" : f.severity === "medium" ? "partial" : "queued"}
                  label={`${f.severity} severity`} />
              </div>
              <div>{f.description}</div>
              <div className="small muted">
                Personas: {f.affectedPersonas.join(", ") || "–"} · Sessions: {f.evidenceSessionIds.join(", ") || "–"}
              </div>
              <div className="small"><strong>Recommendation:</strong> {f.recommendation}</div>
            </div>
          ))}
          {study.synthesis.whatWorked.length > 0 && (
            <>
              <h3>What worked</h3>
              <ul className="tight">{study.synthesis.whatWorked.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </>
          )}
          <h3 style={{ marginTop: 12 }}>Differences between personas</h3>
          <p className="small">{study.synthesis.personaDifferences}</p>
          <p className="small muted" style={{ marginBottom: 0 }}>{study.synthesis.caveats}</p>
        </div>
      ) : study.status === "synthesizing" ? (
        <div className="card muted">Writing the synthesis…</div>
      ) : study.synthesisError ? (
        <div className="card error small">Synthesis failed: {study.synthesisError}</div>
      ) : null}

      <h2 style={{ marginTop: 24 }}>Sessions</h2>
      {study.sessions.map((s) => (
        <SessionCard key={s.id} session={s} shot={shot} onZoom={setLightbox} />
      ))}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Screenshot" />
        </div>
      )}
    </>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <div className="stat">
      <div className="v">{v}</div>
      <div className="l">{l}</div>
    </div>
  );
}

function SessionCard({
  session: s,
  shot,
  onZoom,
}: {
  session: Session;
  shot: (f: string) => string;
  onZoom: (src: string) => void;
}) {
  const d = s.debrief;
  const last = s.steps[s.steps.length - 1];
  return (
    <div className="card">
      <div className="spread">
        <h3>
          {s.personaName} <span className="muted small">· run {s.runNumber} · {s.id}</span>
        </h3>
        <div className="row">
          <StatusBadge status={s.status} />
          {d && <StatusBadge status={d.outcome} label={d.outcome === "completed" ? "says completed" : "gave up"} />}
          {s.evaluation && <StatusBadge status={s.evaluation.success} label={`evaluator: ${s.evaluation.success}`} />}
          {s.endReason === "step_limit" && <StatusBadge status="partial" label="ran out of actions" />}
        </div>
      </div>

      {s.status === "running" && last && (
        <p className="small muted">
          Step {last.index}: {last.action} on {last.pageTitle || last.url}
          {last.thought && <> - <em>“{last.thought}”</em></>}
        </p>
      )}
      {s.error && <p className="error small">{s.error}</p>}

      {d && (
        <>
          <blockquote>“{d.quote}”</blockquote>
          <p className="small">{d.summary}</p>
          <p className="small">
            Ease <strong>{d.easeRating}/7</strong> · Confidence <strong>{d.confidence}/7</strong> ·{" "}
            {Math.max(0, s.steps.length - 1)} actions
          </p>
          {d.frictionPoints.length > 0 && (
            <>
              <strong className="small">Friction points</strong>
              <ul className="tight small">
                {d.frictionPoints.map((f, i) => (
                  <li key={i}>
                    <StatusBadge status={f.severity === "high" ? "failed" : f.severity === "medium" ? "partial" : "queued"}
                      label={f.severity} /> {f.description}
                    {f.step != null && <span className="muted"> (step {f.step})</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {d.positives.length > 0 && (
            <>
              <strong className="small">Positives</strong>
              <ul className="tight small">{d.positives.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </>
          )}
          {d.answers.length > 0 && (
            <>
              <strong className="small">Post-task answers</strong>
              <ul className="tight small">
                {d.answers.map((a, i) => (
                  <li key={i}><strong>{a.question}</strong> {a.answer}</li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      {s.evaluation && <p className="small muted">Evaluator: {s.evaluation.reasoning}</p>}

      {s.steps.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary>Step-by-step replay ({s.steps.length} screens)</summary>
          <div className="steps">
            {s.steps.map((st) => (
              <div key={st.index} className="step">
                {st.screenshot ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shot(st.screenshot)} alt={`Step ${st.index}`} loading="lazy"
                    onClick={() => onZoom(shot(st.screenshot!))} />
                ) : <div />}
                <div>
                  <div className="small">
                    <strong>{st.index}. {st.action}</strong>{" "}
                    <code className="muted">{Object.keys(st.input).length ? JSON.stringify(st.input) : ""}</code>
                  </div>
                  {st.thought && <div className="thought">“{st.thought}”</div>}
                  <div className="small muted">{st.pageTitle} · {st.url}</div>
                  {st.error && <div className="small error">{st.error}</div>}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
      <p className="small muted" style={{ marginBottom: 0 }}>
        Tokens: {s.usage.inputTokens.toLocaleString()} in · {s.usage.outputTokens.toLocaleString()} out ·{" "}
        {s.usage.cacheReadTokens.toLocaleString()} cache reads
      </p>
    </div>
  );
}
