export interface PaperclipMcpConfig {
  apiUrl: string;
  apiKey: string;
  companyId: string | null;
  agentId: string | null;
  runId: string | null;
  /** Agent role (e.g. "engineer", "ceo"). Used for role-based tool filtering when allowedTools is not set explicitly. */
  agentRole: string | null;
  /** Explicit tool allowlist (comma-separated in env). Overrides role-based defaults when set. */
  allowedTools: string[] | null;
}

function nonEmpty(value: string | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function normalizeApiUrl(apiUrl: string): string {
  const trimmed = stripTrailingSlash(apiUrl.trim());
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

export function readConfigFromEnv(env: NodeJS.ProcessEnv = process.env): PaperclipMcpConfig {
  const apiUrl = nonEmpty(env.PAPERCLIP_API_URL);
  if (!apiUrl) {
    throw new Error("Missing PAPERCLIP_API_URL");
  }
  const apiKey = nonEmpty(env.PAPERCLIP_API_KEY);
  if (!apiKey) {
    throw new Error("Missing PAPERCLIP_API_KEY");
  }

  const allowedToolsRaw = nonEmpty(env.PAPERCLIP_ALLOWED_TOOLS);
  const allowedTools = allowedToolsRaw
    ? allowedToolsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : null;

  return {
    apiUrl: normalizeApiUrl(apiUrl),
    apiKey,
    companyId: nonEmpty(env.PAPERCLIP_COMPANY_ID),
    agentId: nonEmpty(env.PAPERCLIP_AGENT_ID),
    runId: nonEmpty(env.PAPERCLIP_RUN_ID),
    agentRole: nonEmpty(env.PAPERCLIP_AGENT_ROLE),
    allowedTools,
  };
}
