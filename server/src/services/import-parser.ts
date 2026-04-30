import {
  type AgentProfile,
  jsonImportSchema,
  markdownFrontmatterSchema,
} from "@paperclipai/shared";

export class ImportParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportParseError";
  }
}

export function parseJsonImport(raw: unknown): AgentProfile {
  const result = jsonImportSchema.safeParse(raw);
  if (!result.success) {
    throw new ImportParseError(`Invalid JSON profile: ${result.error.message}`);
  }
  const { schema: _schema, ...profile } = result.data;
  return profile;
}

export function parseMarkdownImport(content: string): AgentProfile {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) {
    throw new ImportParseError("Markdown profile must start with a YAML frontmatter block (--- ... ---)");
  }

  const frontmatterRaw = parseFrontmatterYaml(frontmatterMatch[1]);
  const frontmatterResult = markdownFrontmatterSchema.safeParse(frontmatterRaw);
  if (!frontmatterResult.success) {
    throw new ImportParseError(`Invalid frontmatter: ${frontmatterResult.error.message}`);
  }

  const body = content.slice(frontmatterMatch[0].length).trim();

  const profile: AgentProfile = {
    ...frontmatterResult.data,
  };

  if (body.length > 0) {
    profile.instructionsBundle = { "AGENTS.md": body };
  }

  return profile;
}

function parseFrontmatterYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of yaml.split(/\r?\n/)) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (!key) continue;
    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      result[key] = value.slice(1, -1);
    } else {
      result[key] = value;
    }
  }
  return result;
}
