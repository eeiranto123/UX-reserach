import fs from "fs/promises";
import path from "path";
import { config } from "./config";
import { PersonaSchema, type Persona } from "./types";

/**
 * Personas live as JSON files in /personas so the research team can review and
 * version them through pull requests. Swap this for a database table once
 * personas need to be edited in the UI.
 */
export async function listPersonas(): Promise<{ personas: Persona[]; errors: string[] }> {
  const files = (await fs.readdir(config.personasDir)).filter(
    (f) => f.endsWith(".json") && !f.startsWith("_"),
  );
  const personas: Persona[] = [];
  const errors: string[] = [];
  for (const file of files.sort()) {
    try {
      const raw = JSON.parse(await fs.readFile(path.join(config.personasDir, file), "utf8"));
      const parsed = PersonaSchema.safeParse(raw);
      if (parsed.success) personas.push(parsed.data);
      else errors.push(`${file}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
    } catch (err) {
      errors.push(`${file}: ${(err as Error).message}`);
    }
  }
  return { personas: personas.filter((p) => p.status !== "archived"), errors };
}

export async function getPersona(id: string): Promise<Persona | undefined> {
  const { personas } = await listPersonas();
  return personas.find((p) => p.id === id);
}

/** Renders a persona as the profile text the agent role-plays. */
export function personaProfile(p: Persona): string {
  const scale = (n: number) => `${n}/5`;
  const lines = [
    `Name: ${p.name}`,
    `Role: ${p.role}`,
    `Summary: ${p.summary}`,
    p.demographics.ageRange && `Age range: ${p.demographics.ageRange}`,
    p.demographics.location && `Location: ${p.demographics.location}`,
    p.demographics.language && `Language: ${p.demographics.language}`,
    `Technical comfort: ${scale(p.techComfort)} (1 = avoids technology, 5 = power user)`,
    `Patience: ${scale(p.patience)} (1 = gives up almost immediately, 5 = very persistent)`,
    `Domain knowledge: ${p.domainKnowledge}`,
    `Device: ${p.device}`,
    `Goals:\n${p.goals.map((g) => `- ${g}`).join("\n")}`,
    `Frustrations:\n${p.frustrations.map((g) => `- ${g}`).join("\n")}`,
    `Typical behaviours:\n${p.behaviors.map((g) => `- ${g}`).join("\n")}`,
    p.accessibilityNeeds.length > 0 &&
      `Accessibility needs:\n${p.accessibilityNeeds.map((g) => `- ${g}`).join("\n")}`,
  ];
  return lines.filter(Boolean).join("\n");
}
