import type { CreateConfigValues } from "@paperclipai/adapter-utils";
import { defaultCreateValues } from "../agent-config-defaults";
import { parseFrontmatter } from "../PackageFileTree";

export interface ParsedAgentFile {
  name: string;
  title: string;
  role: string;
  reportsTo: string | null;
  configValues: Partial<CreateConfigValues>;
  /** true when the file should redirect to /company/import instead */
  isZip?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseAdapterConfigIntoValues(
  adapterType: string,
  adapterConfig: Record<string, unknown>,
): Partial<CreateConfigValues> {
  const patch: Partial<CreateConfigValues> = {};

  // Fields that are common across all adapters
  if (str(adapterConfig.model)) patch.model = str(adapterConfig.model);
  if (str(adapterConfig.promptTemplate)) patch.promptTemplate = str(adapterConfig.promptTemplate);
  if (str(adapterConfig.bootstrapPromptTemplate)) patch.bootstrapPrompt = str(adapterConfig.bootstrapPromptTemplate);
  if (str(adapterConfig.cwd)) patch.cwd = str(adapterConfig.cwd);
  if (str(adapterConfig.instructionsFilePath)) patch.instructionsFilePath = str(adapterConfig.instructionsFilePath);
  if (typeof adapterConfig.dangerouslySkipPermissions === "boolean")
    patch.dangerouslySkipPermissions = adapterConfig.dangerouslySkipPermissions;
  if (typeof adapterConfig.dangerouslyBypassSandbox === "boolean")
    patch.dangerouslyBypassSandbox = adapterConfig.dangerouslyBypassSandbox;
  if (typeof adapterConfig.maxTurnsPerRun === "number")
    patch.maxTurnsPerRun = adapterConfig.maxTurnsPerRun;
  if (str(adapterConfig.effort)) patch.thinkingEffort = str(adapterConfig.effort);
  if (typeof adapterConfig.chrome === "boolean") patch.chrome = adapterConfig.chrome;

  // url for http/gateway adapters
  if (str(adapterConfig.url)) patch.url = str(adapterConfig.url);

  return patch;
}

// ── .md parser ───────────────────────────────────────────────────────────────

export function parseAgentMarkdown(content: string): ParsedAgentFile | null {
  const parsed = parseFrontmatter(content);

  const name = parsed ? str(parsed.data.name) : "";
  const body = parsed?.body ?? content;
  const data = parsed?.data ?? {};

  const adapterType = str(data.adapterType || data.adapter_type) || defaultCreateValues.adapterType;

  return {
    name,
    title: str(data.title),
    role: str(data.role) || "general",
    reportsTo: str(data.reportsTo || data.reports_to) || null,
    configValues: {
      adapterType: adapterType as CreateConfigValues["adapterType"],
      model: str(data.model),
      promptTemplate: body.trim() || str(data.promptTemplate),
    },
  };
}

// ── .json parser ─────────────────────────────────────────────────────────────

export function parseAgentJson(raw: unknown): ParsedAgentFile | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  // Support CompanyPortabilityAgentManifestEntry shape
  // and simpler hire-payload shape
  const name = str(obj.name);
  const title = str(obj.title);
  const role = str(obj.role) || "general";
  const reportsTo = str(obj.reportsToSlug || obj.reportsTo) || null;

  const adapterType = str(obj.adapterType || obj.adapter_type) || defaultCreateValues.adapterType;

  const adapterConfig =
    obj.adapterConfig && typeof obj.adapterConfig === "object"
      ? (obj.adapterConfig as Record<string, unknown>)
      : {};

  const configPatch = parseAdapterConfigIntoValues(adapterType, adapterConfig);

  // Also accept top-level model/promptTemplate for simpler formats
  if (!configPatch.model && str(obj.model)) configPatch.model = str(obj.model);
  if (!configPatch.promptTemplate && str(obj.promptTemplate))
    configPatch.promptTemplate = str(obj.promptTemplate);

  return {
    name,
    title,
    role,
    reportsTo,
    configValues: {
      adapterType: adapterType as CreateConfigValues["adapterType"],
      ...configPatch,
    },
  };
}

// ── Entry point ──────────────────────────────────────────────────────────────

export async function parseAgentFile(file: File): Promise<ParsedAgentFile | null> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".zip")) {
    return { name: "", title: "", role: "", reportsTo: null, configValues: {}, isZip: true };
  }

  const text = await file.text();

  if (name.endsWith(".md") || name.endsWith(".mdx")) {
    return parseAgentMarkdown(text);
  }

  if (name.endsWith(".json")) {
    try {
      return parseAgentJson(JSON.parse(text));
    } catch {
      return null;
    }
  }

  // Try to auto-detect: if starts with "{" treat as JSON, else try markdown
  if (text.trimStart().startsWith("{")) {
    try {
      return parseAgentJson(JSON.parse(text));
    } catch {
      return null;
    }
  }

  return parseAgentMarkdown(text);
}
