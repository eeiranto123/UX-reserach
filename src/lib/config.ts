import path from "path";

export const config = {
  model: process.env.UXR_MODEL || "claude-opus-5-5",
  /** Effort for the browsing persona agent. Synthesis/evaluation use "high". */
  agentEffort: (process.env.UXR_AGENT_EFFORT || "medium") as
    | "low"
    | "medium"
    | "high"
    | "xhigh"
    | "max",
  maxConcurrentSessions: Math.max(1, Number(process.env.MAX_CONCURRENT_SESSIONS || 3)),
  dataDir: path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.UXR_DATA_DIR || "data"),
  personasDir: path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.UXR_PERSONAS_DIR || "personas"),
  allowedHosts: (process.env.ALLOWED_TARGET_HOSTS || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
};

/** True when `url` is http(s) and its host is an allowlisted host or a subdomain of one. */
export function isAllowedUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const host = parsed.hostname.toLowerCase();
  return config.allowedHosts.some((allowed) => host === allowed || host.endsWith("." + allowed));
}
