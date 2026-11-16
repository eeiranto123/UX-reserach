import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { config } from "./config";
import { SynthesisSchema, type Study, type Synthesis } from "./types";

const client = new Anthropic();

/** Cross-persona synthesis of all finished sessions in a study. */
export async function synthesizeStudy(study: Study): Promise<Synthesis | undefined> {
  const sessions = study.sessions.filter((s) => s.status === "completed");
  if (sessions.length === 0) return undefined;

  const sessionReports = sessions
    .map((s) => {
      const steps = s.steps
        .map((st) => `  ${st.index}. ${st.action} ${JSON.stringify(st.input)} @ ${st.url}${st.error ? ` [error: ${st.error}]` : ""}\n     "${st.thought}"`)
        .join("\n");
      const d = s.debrief;
      return `<session id="${s.id}" persona="${s.personaName}" run="${s.runNumber}">
End reason: ${s.endReason}
Evaluator verdict: ${s.evaluation ? `${s.evaluation.success} - ${s.evaluation.reasoning}` : "n/a"}
${
  d
    ? `Self-reported outcome: ${d.outcome}; ease ${d.easeRating}/7; confidence ${d.confidence}/7
Summary: ${d.summary}
Friction: ${d.frictionPoints.map((f) => `[${f.severity}${f.step != null ? ` @step ${f.step}` : ""}] ${f.description}`).join(" | ") || "none"}
Positives: ${d.positives.join(" | ") || "none"}
Quote: "${d.quote}"
Answers: ${d.answers.map((a) => `${a.question} -> ${a.answer}`).join(" | ") || "none"}`
    : "No debrief (session ended without one)."
}
Steps:
${steps}
</session>`;
    })
    .join("\n\n");

  const response = await client.beta.messages.parse({
    model: config.model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "high", format: betaZodOutputFormat(SynthesisSchema) },
    system:
      "You are a senior UX researcher synthesising a synthetic usability study, where AI agents role-played personas on a live site. Ground every finding in specific sessions and steps. Separate issues that recur across personas from one-offs. Be concrete and actionable, and say plainly when evidence is thin. In caveats, remind readers that synthetic participants are directional and should be validated with real users.",
    messages: [
      {
        role: "user",
        content: `Study: ${study.input.title}
Target: ${study.input.targetUrl}
Scenario: ${study.input.scenario}
Success criteria: ${study.input.successCriteria || "(not specified)"}

${sessionReports}`,
      },
    ],
  });
  return response.parsed_output ?? undefined;
}
