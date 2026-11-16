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
  productsDir: path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.UXR_PRODUCTS_DIR || "products"),
  /** Extra hosts allowed for every product, e.g. staging environments. */
  allowedHosts: (process.env.ALLOWED_TARGET_HOSTS || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
};

export interface UrlPolicy {
  allowedHosts: string[];
  blockedUrlPatterns: string[];
}

/**
 * True when `url` is http(s), its host is in `policy.allowedHosts` (or a
 * subdomain of one) and it contains none of the blocked patterns.
 */
export function isAllowedUrl(url: string, policy: UrlPolicy): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const host = parsed.hostname.toLowerCase();
  const hostOk = policy.allowedHosts
    .map((h) => h.trim().toLowerCase())
    .some((allowed) => host === allowed || host.endsWith("." + allowed));
  const lower = url.toLowerCase();
  return hostOk && !policy.blockedUrlPatterns.some((p) => p && lower.includes(p.toLowerCase()));
}
