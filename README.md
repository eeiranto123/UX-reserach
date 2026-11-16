# Synthetic UX Research

An internal web tool for running quick synthetic usability tests. You pick a product, describe a task and choose
personas, and AI agents role-play those personas in a real headless browser on the product's **live or staging site**. Each session produces a think-aloud
step-by-step replay with screenshots, a debrief (ease rating, friction points, quotes, answers to post-task questions),
and an independent success check. A cross-persona synthesis is written once all sessions are done.

> Synthetic participants give directional signals for fast iteration. They don't replace testing with real users.

## How it works

```
Next.js UI ──► API routes ──► job queue (in-process, N parallel sessions)
                                   │
                                   ▼
                     Claude agent loop  ◄──►  Playwright (headless Chromium)
                     persona = system prompt   screenshot + labelled interactive elements
                     tools: click, type_text, select_option, press_key, scroll, go_back, go_to_url, finish
                                   │
                                   ▼
                     evaluator (success criteria)  ──►  study synthesis
```

- **Products**: JSON files in [`products/`](products/README.md) (currently K-Rauta). Each product defines its allowed
  hosts, browser locale, live/staging environment and blocked URL patterns (checkout, payment).
- **Personas**: JSON files in [`personas/`](personas/README.md), versioned in git.
- **Study**: named automatically as `YYYY-MM-DD <Product> synthetic testing`, e.g. `2026-11-16 K-Rauta synthetic testing`
  (date in the product's timezone). A study is a task definition: product, starting URL, scenario, hidden success criteria, participant info (e.g. a staging test
  login), post-task questions, personas, runs per persona and an action limit.
- **Agent** (`src/lib/agent.ts`): each turn the persona sees a screenshot plus a numbered list of interactive elements,
  then takes one action. Every action includes a first-person `thought`. The session ends when the persona calls
  `finish` (completed or gave up) or runs out of actions.
- **Evaluator**: a separate model call that judges the final page against the success criteria, so results don't rely
  on the persona's self-report.
- **Synthesis** (`src/lib/synthesis.ts`): key findings with severity, affected personas, evidence sessions and
  recommendations.

### Safety rails

- The agent can only navigate to the selected product's `allowedHosts` (plus any extra hosts in `ALLOWED_TARGET_HOSTS`).
  Top-level navigations elsewhere are blocked in the browser; sub-resources such as CDNs still load.
- URLs matching the product's `blockedUrlPatterns` (e.g. checkout, payment) are always blocked. The browser returns to
  the previous page and the persona is told the page is off limits.
- **Live sites**: personas get extra instructions not to order, pay, register, subscribe or submit personal details, and
  to stop and report if the task would need checkout. The UI shows a warning, because synthetic visits can show up in
  the site's analytics.
- Studies can only be created for URLs inside the product's scope.
- The persona is told never to invent credentials or personal data, and not to complete purchases, payments, deletions
  or other irreversible actions.
- Each session runs in an isolated browser context (fresh cookies and storage).

## Running locally

Requires Node 20+.

```bash
npm install
npx playwright install chromium   # first time only
cp .env.example .env.local        # set ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000.

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | – | Claude API key |
| `ALLOWED_TARGET_HOSTS` | – | Optional extra hosts allowed for every product, e.g. staging environments (subdomains included) |
| `MAX_CONCURRENT_SESSIONS` | `3` | Parallel browser sessions |
| `UXR_MODEL` | `claude-opus-5-5` | Model for agents, evaluator and synthesis |
| `UXR_AGENT_EFFORT` | `medium` | Effort for the browsing agent (`low`…`max`) |
| `UXR_DATA_DIR` | `./data` | Where study results and screenshots are stored |
| `UXR_PRODUCTS_DIR` / `UXR_PERSONAS_DIR` | `./products` / `./personas` | Where product and persona files are read from |

Model calls use adaptive thinking, prompt caching, server-side refusal fallback (`fallbacks: "default"`) and
server-side clearing of old screenshots once a session's context grows, so long sessions stay affordable.

## Deploying for the company (next steps)

The MVP deliberately keeps infrastructure minimal. To run it as a shared service:

1. **Auth**: put it behind company SSO (e.g. an identity-aware proxy). The API reads `x-forwarded-email` to record who
   created each study.
2. **Storage**: replace the file store in `src/lib/store.ts` with Postgres (studies/sessions/steps) and object storage
   for screenshots.
3. **Queue/workers**: move `src/lib/runner.ts` to a real queue (pg-boss or BullMQ) with separate worker containers that
   run Playwright, so web servers stay light and sessions survive restarts.
4. **Cost controls**: per-user and per-study budgets. Token usage is already recorded per session.
5. **Persona editing in the UI** once the research team's personas are ready.

## Roadmap

- **Figma prototypes**: add `targetType: "figma"` and open the prototype's share link. Prototypes are mostly canvas,
  so this mode would rely on screenshots and coordinate clicks instead of the element list.
- Compare studies (before/after a design change), export reports to PDF/Notion/Slack, study templates.
