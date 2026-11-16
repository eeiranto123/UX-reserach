import { z } from "zod";

// ---------------------------------------------------------------------------
// Personas
// ---------------------------------------------------------------------------

export const PersonaSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id must be kebab-case"),
  /** "draft" until the persona is grounded in real research evidence. */
  status: z.enum(["draft", "validated", "archived"]),
  name: z.string(),
  summary: z.string(),
  role: z.string(),
  demographics: z
    .object({
      ageRange: z.string().optional(),
      location: z.string().optional(),
      language: z.string().optional(),
    })
    .default({}),
  goals: z.array(z.string()),
  frustrations: z.array(z.string()),
  behaviors: z.array(z.string()),
  /** 1 = avoids technology, 5 = power user */
  techComfort: z.number().int().min(1).max(5),
  /** 1 = gives up almost immediately, 5 = very persistent */
  patience: z.number().int().min(1).max(5),
  domainKnowledge: z.string(),
  accessibilityNeeds: z.array(z.string()).default([]),
  device: z.enum(["desktop", "mobile"]).default("desktop"),
  /** Links to the research this persona is based on (interviews, surveys, analytics). */
  evidence: z
    .array(z.object({ source: z.string(), note: z.string().optional() }))
    .default([]),
  owner: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Persona = z.infer<typeof PersonaSchema>;

// ---------------------------------------------------------------------------
// Study (the task definition) - what the UI submits
// ---------------------------------------------------------------------------

export const StudyInputSchema = z.object({
  title: z.string().min(1).max(200),
  /** Only "url" for now. "figma" (prototype share links) is planned. */
  targetType: z.literal("url").default("url"),
  targetUrl: z.string().url(),
  /** The scenario as it is read to the participant. */
  scenario: z.string().min(1).max(4000),
  /** How we judge success. Hidden from the persona, used by the evaluator. */
  successCriteria: z.string().max(2000).default(""),
  /** Extra info handed to the participant, e.g. a staging test login. */
  participantContext: z.string().max(2000).default(""),
  postTaskQuestions: z.array(z.string().min(1).max(500)).max(10).default([]),
  personaIds: z.array(z.string()).min(1).max(10),
  runsPerPersona: z.number().int().min(1).max(5).default(1),
  maxSteps: z.number().int().min(5).max(60).default(25),
});
export type StudyInput = z.infer<typeof StudyInputSchema>;

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export type SessionStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "interrupted";

export interface Step {
  index: number;
  action: string;
  input: Record<string, unknown>;
  thought: string;
  url: string;
  pageTitle: string;
  screenshot?: string; // file name inside the study's screenshot folder
  error?: string;
  at: string;
}

export const FrictionPointSchema = z.object({
  severity: z.enum(["low", "medium", "high"]),
  description: z.string(),
  step: z.number().int().nullable(),
});

export const DebriefSchema = z.object({
  outcome: z.enum(["completed", "gave_up"]),
  summary: z.string(),
  easeRating: z.number().int().min(1).max(7),
  confidence: z.number().int().min(1).max(7),
  frictionPoints: z.array(FrictionPointSchema),
  positives: z.array(z.string()),
  quote: z.string(),
  answers: z.array(z.object({ question: z.string(), answer: z.string() })),
});
export type Debrief = z.infer<typeof DebriefSchema>;

export const EvaluationSchema = z.object({
  success: z.enum(["success", "partial", "failure", "unclear"]),
  reasoning: z.string(),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

export interface Session {
  id: string;
  personaId: string;
  personaName: string;
  runNumber: number;
  status: SessionStatus;
  steps: Step[];
  debrief?: Debrief;
  evaluation?: Evaluation;
  endReason?: "finished" | "step_limit" | "refusal" | "error";
  error?: string;
  startedAt?: string;
  finishedAt?: string;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
}

export const SynthesisSchema = z.object({
  headline: z.string(),
  keyFindings: z.array(
    z.object({
      title: z.string(),
      severity: z.enum(["low", "medium", "high"]),
      description: z.string(),
      affectedPersonas: z.array(z.string()),
      evidenceSessionIds: z.array(z.string()),
      recommendation: z.string(),
    }),
  ),
  personaDifferences: z.string(),
  whatWorked: z.array(z.string()),
  caveats: z.string(),
});
export type Synthesis = z.infer<typeof SynthesisSchema>;

export type StudyStatus = "queued" | "running" | "synthesizing" | "completed" | "failed";

export interface Study {
  id: string;
  createdAt: string;
  createdBy?: string;
  input: StudyInput;
  status: StudyStatus;
  sessions: Session[];
  synthesis?: Synthesis;
  synthesisError?: string;
}
