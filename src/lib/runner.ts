import { randomUUID } from "crypto";
import { runPersonaSession } from "./agent";
import { config } from "./config";
import { getPersona } from "./personas";
import { listStudies, loadStudy, saveStudy, updateStudy } from "./store";
import { synthesizeStudy } from "./synthesis";
import type { Session, Study, StudyInput } from "./types";

/**
 * In-process job queue for the MVP. Each persona x run is one job; up to
 * MAX_CONCURRENT_SESSIONS run in parallel. For a company-wide deployment move
 * this to a real queue (e.g. pg-boss / BullMQ) with separate worker containers.
 */
interface Job {
  studyId: string;
  sessionId: string;
}

const g = globalThis as unknown as {
  __uxrQueue?: { pending: Job[]; active: number; recovered: boolean };
};
const queue = (g.__uxrQueue ??= { pending: [], active: 0, recovered: false });

export async function createStudy(input: StudyInput, createdBy?: string): Promise<Study> {
  const sessions: Session[] = [];
  for (const personaId of input.personaIds) {
    const persona = await getPersona(personaId);
    if (!persona) throw new Error(`Unknown persona: ${personaId}`);
    for (let run = 1; run <= input.runsPerPersona; run++) {
      sessions.push({
        id: `s${sessions.length + 1}-${randomUUID().slice(0, 6)}`,
        personaId,
        personaName: persona.name,
        runNumber: run,
        status: "queued",
        steps: [],
        usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 },
      });
    }
  }
  const study: Study = {
    id: `${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    createdBy,
    input,
    status: "queued",
    sessions,
  };
  await saveStudy(study);
  for (const s of sessions) queue.pending.push({ studyId: study.id, sessionId: s.id });
  pump();
  return study;
}

/** On first use after a server restart, mark sessions that were mid-flight as interrupted. */
export async function recoverInterrupted(): Promise<void> {
  if (queue.recovered) return;
  queue.recovered = true;
  for (const study of await listStudies()) {
    if (study.status === "completed" || study.status === "failed") continue;
    await updateStudy(study.id, (s) => {
      for (const sess of s.sessions) {
        if (sess.status === "running" || sess.status === "queued") {
          sess.status = "interrupted";
          sess.error = "The server restarted before this session finished.";
        }
      }
      s.status = s.sessions.some((x) => x.status === "completed") ? "completed" : "failed";
    });
  }
}

function pump(): void {
  while (queue.active < config.maxConcurrentSessions && queue.pending.length > 0) {
    const job = queue.pending.shift()!;
    queue.active += 1;
    runJob(job)
      .catch((err) => console.error("[uxr] job crashed", job, err))
      .finally(() => {
        queue.active -= 1;
        pump();
      });
  }
}

async function runJob({ studyId, sessionId }: Job): Promise<void> {
  const study = await updateStudy(studyId, (s) => {
    s.status = "running";
    const sess = s.sessions.find((x) => x.id === sessionId)!;
    sess.status = "running";
    sess.startedAt = new Date().toISOString();
  });
  const session = study.sessions.find((x) => x.id === sessionId)!;
  const persona = await getPersona(session.personaId);

  const mutateSession = (fn: (s: Session) => void) =>
    updateStudy(studyId, (st) => fn(st.sessions.find((x) => x.id === sessionId)!));

  if (!persona) {
    await mutateSession((s) => {
      s.status = "failed";
      s.error = `Persona ${session.personaId} no longer exists.`;
    });
  } else {
    const result = await runPersonaSession({
      studyId,
      sessionId,
      persona,
      input: study.input,
      callbacks: {
        onStep: (step) => mutateSession((s) => void s.steps.push(step)).then(() => undefined),
        onUsage: (u) =>
          mutateSession((s) => {
            s.usage.inputTokens += u.inputTokens;
            s.usage.outputTokens += u.outputTokens;
            s.usage.cacheReadTokens += u.cacheReadTokens;
          }).then(() => undefined),
      },
    });
    await mutateSession((s) => {
      s.endReason = result.endReason;
      s.debrief = result.debrief;
      s.evaluation = result.evaluation;
      s.error = result.error;
      s.finishedAt = new Date().toISOString();
      s.status = result.endReason === "finished" || result.endReason === "step_limit" ? "completed" : "failed";
    });
  }

  await maybeFinishStudy(studyId);
}

async function maybeFinishStudy(studyId: string): Promise<void> {
  let shouldSynthesize = false;
  await updateStudy(studyId, (s) => {
    const done = s.sessions.every((x) => ["completed", "failed", "interrupted"].includes(x.status));
    if (done && s.status === "running") {
      s.status = "synthesizing";
      shouldSynthesize = true;
    }
  });
  if (!shouldSynthesize) return;

  const study = (await loadStudy(studyId))!;
  try {
    const synthesis = await synthesizeStudy(study);
    await updateStudy(studyId, (s) => {
      s.synthesis = synthesis;
      s.status = s.sessions.some((x) => x.status === "completed") ? "completed" : "failed";
    });
  } catch (err) {
    await updateStudy(studyId, (s) => {
      s.synthesisError = (err as Error).message;
      s.status = s.sessions.some((x) => x.status === "completed") ? "completed" : "failed";
    });
  }
}
