import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import fs from "fs/promises";
import path from "path";
import { BrowserSession, type Observation } from "./browser";
import { config } from "./config";
import { personaProfile } from "./personas";
import { urlPolicy } from "./products";
import { screenshotsDir } from "./store";
import {
  DebriefSchema,
  EvaluationSchema,
  type Debrief,
  type Evaluation,
  type Persona,
  type Product,
  type Step,
  type StudyInput,
} from "./types";

type BetaMessageParam = Anthropic.Beta.BetaMessageParam;
type BetaToolResultBlockParam = Anthropic.Beta.BetaToolResultBlockParam;
type BetaToolUseBlock = Anthropic.Beta.BetaToolUseBlock;

const client = new Anthropic();

// Server-side refusal fallback + server-side clearing of old screenshots.
const BETAS: Anthropic.Beta.AnthropicBeta[] = [
  "server-side-fallback-2026-07-01",
  "context-management-2025-06-27",
];

// ---------------------------------------------------------------------------
// Tools the persona can use. Every action carries a first-person `thought`
// so we capture think-aloud commentary for each step.
// ---------------------------------------------------------------------------

const thought = {
  type: "string",
  description:
    "Think aloud in first person, in character: what you see, what you expect, how you feel. 1-3 sentences.",
} as const;

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "click",
    description: "Click (or tap on mobile) the element with the given [ref] number from the current screen.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { thought, ref: { type: "integer" } },
      required: ["thought", "ref"],
      additionalProperties: false,
    },
  },
  {
    name: "type_text",
    description: "Type into a text field (replaces its current value). Set submit=true to press Enter afterwards.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { thought, ref: { type: "integer" }, text: { type: "string" }, submit: { type: "boolean" } },
      required: ["thought", "ref", "text", "submit"],
      additionalProperties: false,
    },
  },
  {
    name: "select_option",
    description: "Choose an option in a dropdown (<select>) by its visible text.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { thought, ref: { type: "integer" }, option: { type: "string" } },
      required: ["thought", "ref", "option"],
      additionalProperties: false,
    },
  },
  {
    name: "press_key",
    description: "Press a keyboard key, e.g. Enter, Escape, Tab.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { thought, key: { type: "string", enum: ["Enter", "Escape", "Tab", "Shift+Tab", "ArrowDown", "ArrowUp", "Space"] } },
      required: ["thought", "key"],
      additionalProperties: false,
    },
  },
  {
    name: "scroll",
    description: "Scroll the page up or down by most of a screen.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { thought, direction: { type: "string", enum: ["up", "down"] } },
      required: ["thought", "direction"],
      additionalProperties: false,
    },
  },
  {
    name: "go_back",
    description: "Press the browser back button.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { thought },
      required: ["thought"],
      additionalProperties: false,
    },
  },
  {
    name: "go_to_url",
    description:
      "Type a URL into the address bar. Real users rarely do this - only use it if your persona plausibly would (e.g. returning to the home page).",
    strict: true,
    input_schema: {
      type: "object",
      properties: { thought, url: { type: "string" } },
      required: ["thought", "url"],
      additionalProperties: false,
    },
  },
  {
    name: "finish",
    description:
      "End the session, either because you completed the task or because you (as this persona) would give up. Then answer the debrief honestly, in character.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        outcome: { type: "string", enum: ["completed", "gave_up"] },
        summary: { type: "string", description: "What you did and where you ended up, 2-4 sentences, first person." },
        easeRating: { type: "integer", description: "1 = very difficult, 7 = very easy" },
        confidence: { type: "integer", description: "1 = not at all confident the task is done correctly, 7 = completely confident" },
        frictionPoints: {
          type: "array",
          items: {
            type: "object",
            properties: {
              severity: { type: "string", enum: ["low", "medium", "high"] },
              description: { type: "string" },
              step: { type: ["integer", "null"], description: "Step number where it happened, if known" },
            },
            required: ["severity", "description", "step"],
            additionalProperties: false,
          },
        },
        positives: { type: "array", items: { type: "string" } },
        quote: { type: "string", description: "One sentence you would say to the researcher about this experience." },
        answers: {
          type: "array",
          items: {
            type: "object",
            properties: { question: { type: "string" }, answer: { type: "string" } },
            required: ["question", "answer"],
            additionalProperties: false,
          },
        },
      },
      required: ["outcome", "summary", "easeRating", "confidence", "frictionPoints", "positives", "quote", "answers"],
      additionalProperties: false,
    },
  },
];

function systemPrompt(persona: Persona, product: Product): string {
  const live =
    product.environment === "live"
      ? `

IMPORTANT - this is the LIVE public ${product.name} website with real customers and real orders:
- Never place an order, start a payment, book a service, create an account, subscribe to a newsletter or submit any form that sends personal details.
- Browsing, searching, filtering, comparing and adding items to the cart are fine. If the task would require checkout or payment, stop at that point and call finish, describing where you stopped and whether you would have been able to continue.
- Checkout and payment pages are blocked; if a click is blocked, treat it as the end of what you are allowed to do.`
      : "";
  return systemPromptBase(persona, product) + live;
}

function systemPromptBase(persona: Persona, product: Product): string {
  return `You are taking part in a usability test of the ${product.name} website as a synthetic research participant. You role-play the persona below and use a real web browser through tools. The site may be in a language other than English (browser locale: ${product.locale}); react to it the way this persona realistically would, but write your thoughts and debrief in English.

<persona>
${personaProfile(persona)}
</persona>

How to behave:
- Stay in character the whole time. Act with this persona's knowledge, vocabulary, patience and habits - not your own. If the persona would not know what a term means, don't pretend to.
- Behave like a real person using the site for the first time: scan the screen, try what looks most obvious, and react honestly to confusion, delays or surprises. Don't use outside knowledge of how this product works.
- Each turn you get a screenshot plus a list of interactive elements on screen with [ref] numbers. Use one action per turn.
- Put your think-aloud commentary in the "thought" field of every action.
- If this persona would realistically give up (lost, frustrated, out of patience), stop and call finish with outcome "gave_up". Giving up is a valid, useful result.
- Use only the information the researcher gives you (for example a test login). Never invent personal, payment or login details. Do not complete real purchases, payments, deletions or anything irreversible; if the next step would do that, stop and call finish explaining where you stopped.
- When done, call finish and answer the debrief honestly from the persona's point of view.`;
}

function taskBrief(input: StudyInput): string {
  const parts = [`Your task:\n${input.scenario}`];
  if (input.participantContext.trim()) parts.push(`Information from the researcher:\n${input.participantContext}`);
  if (input.postTaskQuestions.length)
    parts.push(
      `After the task you will be asked these questions (answer them in the finish debrief):\n${input.postTaskQuestions
        .map((q, i) => `${i + 1}. ${q}`)
        .join("\n")}`,
    );
  parts.push("The browser is open on the starting page. Begin when ready.");
  return parts.join("\n\n");
}

function observationBlocks(
  obs: Observation,
  stepsLeft: number,
): Array<Anthropic.Beta.BetaTextBlockParam | Anthropic.Beta.BetaImageBlockParam> {
  const scrollInfo =
    obs.scroll.maxY > 0 ? `Scroll position: ${obs.scroll.y}px of ${obs.scroll.maxY}px` : "The page fits on one screen.";
  return [
    {
      type: "text",
      text: `Current page: ${obs.title || "(untitled)"}\nURL: ${obs.url}\n${scrollInfo}\nActions remaining: ${stepsLeft}\n\nInteractive elements on screen:\n${obs.elementsText}`,
    },
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: obs.screenshot.toString("base64") } },
  ];
}

export interface SessionCallbacks {
  onStep: (step: Step) => Promise<void>;
  onUsage: (u: { inputTokens: number; outputTokens: number; cacheReadTokens: number }) => Promise<void>;
}

export interface SessionResult {
  endReason: "finished" | "step_limit" | "refusal" | "error";
  debrief?: Debrief;
  evaluation?: Evaluation;
  error?: string;
}

export async function runPersonaSession(opts: {
  studyId: string;
  sessionId: string;
  persona: Persona;
  product: Product;
  input: StudyInput;
  callbacks: SessionCallbacks;
}): Promise<SessionResult> {
  const { studyId, sessionId, persona, product, input, callbacks } = opts;
  const shotDir = screenshotsDir(studyId);
  await fs.mkdir(shotDir, { recursive: true });

  const browser = await BrowserSession.create({
    device: persona.device,
    policy: urlPolicy(product),
    locale: product.locale,
    timezone: product.timezone,
  });
  let stepIndex = 0;

  const record = async (
    action: string,
    actionInput: Record<string, unknown>,
    obs: Observation,
    error?: string,
  ): Promise<void> => {
    const file = `${sessionId}-${String(stepIndex).padStart(3, "0")}.jpg`;
    await fs.writeFile(path.join(shotDir, file), obs.screenshot);
    const { thought: t, ...rest } = actionInput;
    await callbacks.onStep({
      index: stepIndex,
      action,
      input: rest,
      thought: typeof t === "string" ? t : "",
      url: obs.url,
      pageTitle: obs.title,
      screenshot: file,
      error,
      at: new Date().toISOString(),
    });
    stepIndex += 1;
  };

  try {
    await browser.goto(input.targetUrl);
    let obs = await browser.observe();
    await record("open", { url: input.targetUrl }, obs);

    const messages: BetaMessageParam[] = [
      {
        role: "user",
        content: [{ type: "text", text: taskBrief(input) }, ...observationBlocks(obs, input.maxSteps)],
      },
    ];

    let actionsUsed = 0;
    let wrapUpTurns = 0;

    while (true) {
      const response = await client.beta.messages.create({
        model: config.model,
        max_tokens: 16000,
        betas: BETAS,
        fallbacks: "default",
        system: systemPrompt(persona, product),
        tools: TOOLS,
        tool_choice: { type: "auto", disable_parallel_tool_use: true },
        thinking: { type: "adaptive" },
        output_config: { effort: config.agentEffort },
        cache_control: { type: "ephemeral" },
        // Old screenshots are cleared server-side once the transcript grows;
        // the latest few observations stay intact.
        context_management: {
          edits: [
            {
              type: "clear_tool_uses_20250919",
              trigger: { type: "input_tokens", value: 60_000 },
              keep: { type: "tool_uses", value: 4 },
              exclude_tools: ["finish"],
            },
          ],
        },
        messages,
      });

      await callbacks.onUsage({
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      });

      if (response.stop_reason === "refusal") {
        return { endReason: "refusal", error: response.stop_details?.explanation ?? "The model declined to continue." };
      }

      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "pause_turn") continue;

      const toolUses = response.content.filter((b): b is BetaToolUseBlock => b.type === "tool_use");

      if (toolUses.length === 0) {
        // The model replied in plain text; nudge it back to using the browser.
        if (++wrapUpTurns > 3) return { endReason: "error", error: "Agent stopped without calling finish." };
        messages.push({
          role: "user",
          content: "Please continue using the browser tools, or call finish if you are done or would give up.",
        });
        continue;
      }
      if (response.stop_reason === "max_tokens") {
        return { endReason: "error", error: "Response hit max_tokens mid tool call." };
      }

      const results: Array<BetaToolResultBlockParam | Anthropic.Beta.BetaTextBlockParam> = [];
      let finishedWith: Debrief | undefined;

      for (const tu of toolUses) {
        const args = (tu.input ?? {}) as Record<string, unknown>;

        if (tu.name === "finish") {
          const parsed = DebriefSchema.safeParse({
            ...args,
            easeRating: clampInt(args.easeRating, 1, 7),
            confidence: clampInt(args.confidence, 1, 7),
          });
          if (parsed.success) {
            finishedWith = parsed.data;
            results.push({ type: "tool_result", tool_use_id: tu.id, content: "Session ended. Thank you!" });
          } else {
            results.push({
              type: "tool_result",
              tool_use_id: tu.id,
              is_error: true,
              content: `Debrief was invalid: ${parsed.error.issues.map((i) => i.message).join("; ")}. Please call finish again.`,
            });
          }
          continue;
        }

        if (actionsUsed >= input.maxSteps) {
          results.push({
            type: "tool_result",
            tool_use_id: tu.id,
            is_error: true,
            content: "No actions remaining. Call finish now.",
          });
          continue;
        }

        let error: string | undefined;
        try {
          await performAction(browser, tu.name, args);
        } catch (err) {
          error = (err as Error).message.split("\n")[0].slice(0, 300);
        }
        actionsUsed += 1;
        obs = await browser.observe();
        await record(tu.name, args, obs, error);

        const blocks = observationBlocks(obs, input.maxSteps - actionsUsed);
        if (error) blocks.unshift({ type: "text", text: `That action failed: ${error}` });
        results.push({ type: "tool_result", tool_use_id: tu.id, content: blocks, is_error: Boolean(error) || undefined });
      }

      if (finishedWith) {
        const evaluation = await evaluateSession(browser, input, finishedWith).catch(() => undefined);
        return { endReason: "finished", debrief: finishedWith, evaluation };
      }

      if (actionsUsed >= input.maxSteps) {
        if (++wrapUpTurns > 2) {
          const evaluation = await evaluateSession(browser, input, undefined).catch(() => undefined);
          return { endReason: "step_limit", evaluation };
        }
        results.push({
          type: "text",
          text: "You have run out of time for this task. Call finish now with your debrief (outcome gave_up unless you already completed it).",
        });
      }

      messages.push({ role: "user", content: results });
    }
  } catch (err) {
    return { endReason: "error", error: err instanceof Error ? err.message : String(err) };
  } finally {
    await browser.close();
  }
}

function clampInt(v: unknown, min: number, max: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

async function performAction(browser: BrowserSession, name: string, args: Record<string, unknown>) {
  const ref = Number(args.ref);
  switch (name) {
    case "click":
      return browser.click(ref);
    case "type_text":
      return browser.type(ref, String(args.text ?? ""), Boolean(args.submit));
    case "select_option":
      return browser.selectOption(ref, String(args.option ?? ""));
    case "press_key":
      return browser.pressKey(String(args.key));
    case "scroll":
      return browser.scroll(args.direction === "up" ? "up" : "down");
    case "go_back":
      return browser.goBack();
    case "go_to_url": {
      const url = String(args.url ?? "");
      if (!browser.isAllowed(url)) throw new Error("That address is outside the allowed test scope and was blocked.");
      return browser.goto(url);
    }
    default:
      throw new Error(`Unknown action ${name}`);
  }
}

/**
 * Independent judge: did the session meet the study's success criteria?
 * Looks at the final page, not just what the persona claims.
 */
async function evaluateSession(
  browser: BrowserSession,
  input: StudyInput,
  debrief: Debrief | undefined,
): Promise<Evaluation | undefined> {
  const obs = await browser.observe();
  const pageText = await browser.visibleText();
  const criteria = input.successCriteria.trim() || "The participant accomplished the task described in the scenario.";
  const response = await client.beta.messages.parse({
    model: config.model,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "high", format: betaZodOutputFormat(EvaluationSchema) },
    system:
      "You evaluate usability test sessions. Judge only from the evidence given (final page state and the participant's report). Participants can be wrong about whether they succeeded. Use 'unclear' if the evidence is insufficient.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Scenario given to participant:\n${input.scenario}\n\nSuccess criteria:\n${criteria}\n\nParticipant's report: ${
              debrief ? `${debrief.outcome} - ${debrief.summary}` : "(none - the session ran out of steps)"
            }\n\nFinal URL: ${obs.url}\nFinal page title: ${obs.title}\n\nFinal page text (truncated):\n${pageText}`,
          },
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: obs.screenshot.toString("base64") } },
        ],
      },
    ],
  });
  return response.parsed_output ?? undefined;
}
