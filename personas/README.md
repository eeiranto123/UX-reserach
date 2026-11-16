# Personas

Each `.json` file in this folder is one persona available in the tool. Files starting with `_` are ignored.

- **Edit through pull requests** so the UX research team can review changes.
- `status`: `draft` (placeholder, not yet research-based), `validated` (grounded in evidence) or `archived` (hidden).
- `evidence`: link the interviews, surveys or analytics the persona is based on. A persona with no evidence is a guess.
- `techComfort` and `patience` are 1–5 and strongly shape how the agent behaves (how quickly it gives up, how it reads pages).
- `device`: `desktop` (1280×800) or `mobile` (390×844, touch).

The schema is defined in `src/lib/types.ts` (`PersonaSchema`). Invalid files show up as an error on the persona page.

`draft-busy-operations-manager.json` is a placeholder until the research-based personas are ready.
